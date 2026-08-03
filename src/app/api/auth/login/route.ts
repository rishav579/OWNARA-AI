import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, hashToken } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { checkAuthRateLimit } from "@/lib/rate-limiter";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 auth attempts per minute per IP
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.allowed) {
      return error("RATE_LIMITED", "Too many login attempts. Please try again in a minute.", 429);
    }

    const body = await parseBody<z.infer<typeof loginSchema>>(request);
    const { email, password } = loginSchema.parse(body);

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        workspaceMembers: {
          where: { status: "active" },
          include: { workspace: true },
        },
      },
    });

    if (!user || user.status !== "active") {
      return error("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return error("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const workspaces = user.workspaceMembers.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    }));

    const activeWorkspace = workspaces[0];
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: activeWorkspace?.id,
      role: activeWorkspace?.role,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Store refresh token session
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return success({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status,
        avatarColor: user.avatarColor,
      },
      workspaces,
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
