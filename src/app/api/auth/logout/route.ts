import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser, compareToken } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return error("UNAUTHORIZED", "Authentication required.", 401);
    }

    const body = await parseBody<z.infer<typeof logoutSchema>>(request);
    const { refreshToken } = logoutSchema.parse(body);

    if (refreshToken) {
      // Find and revoke the session
      const sessions = await db.session.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      for (const session of sessions) {
        if (compareToken(refreshToken, session.tokenHash)) {
          await db.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    }

    return success({ message: "Logged out successfully." });
  } catch (err) {
    return handleApiError(err);
  }
}
