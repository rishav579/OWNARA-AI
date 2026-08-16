import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return error("UNAUTHORIZED", "Authentication required.", 401);
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        workspaceMembers: {
          where: { status: "active" },
          include: { workspace: true },
        },
      },
    });

    if (!fullUser) {
      return error("NOT_FOUND", "User not found.", 404);
    }

    const workspaces = fullUser.workspaceMembers.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    }));

    return success({
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        emailVerifiedAt: fullUser.emailVerifiedAt,
        status: fullUser.status,
        avatarColor: fullUser.avatarColor,
        createdAt: fullUser.createdAt,
      },
      workspaces,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
