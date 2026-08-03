import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyToken, signAccessToken, signRefreshToken, hashToken, compareToken, ACCESS_TOKEN_TTL } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { checkAuthRateLimit } from "@/lib/rate-limiter";

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/**
 * POST /api/auth/refresh
 *
 * Exchanges a valid refresh token for a new access token + new refresh token.
 * The old refresh token is revoked (rotation — prevents token reuse attacks).
 *
 * Flow:
 * 1. Verify the refresh token signature + type
 * 2. Find the matching session in the database (by comparing token hash)
 * 3. Check the session is not revoked or expired
 * 4. Revoke the old session (token rotation)
 * 5. Create a new session with new refresh token
 * 6. Return new access + refresh tokens
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 refresh attempts per minute per IP
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.allowed) {
      return error("RATE_LIMITED", "Too many refresh attempts. Please try again in a minute.", 429);
    }

    const body = await parseBody<z.infer<typeof refreshSchema>>(request);
    const { refreshToken } = refreshSchema.parse(body);

    // Step 1: Verify token signature
    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return error("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.", 401);
    }

    // Step 2: Find matching session
    const sessions = await db.session.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedSession = null;
    for (const session of sessions) {
      if (compareToken(refreshToken, session.tokenHash)) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      return error("SESSION_NOT_FOUND", "Session not found or already revoked.", 401);
    }

    // Step 3: Revoke the old session (token rotation)
    await db.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    // Step 4: Create new session with new tokens
    const tokenPayload = {
      sub: payload.sub,
      email: payload.email,
      workspaceId: payload.workspaceId,
      role: payload.role,
    };

    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    await db.session.create({
      data: {
        userId: payload.sub,
        tokenHash: hashToken(newRefreshToken),
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return success({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
