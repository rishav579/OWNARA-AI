import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, signAccessToken, signRefreshToken, hashToken } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  workspaceName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody<z.infer<typeof signupSchema>>(request);
    const { email, password, name, workspaceName } = signupSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return error("CONFLICT", "An account with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(password);
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        avatarColor: "#10b981",
        status: "active",
        emailVerifiedAt: new Date(),
      },
    });

    const workspace = await db.workspace.create({
      data: {
        name: workspaceName,
        slug,
        ownerUserId: user.id,
        defaultRegion: "in-central",
        status: "active",
      },
    });

    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
    });

    const tokenPayload = { sub: user.id, email: user.email, workspaceId: workspace.id, role: "owner" };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

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
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      accessToken,
      refreshToken,
      expiresIn: 900,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
