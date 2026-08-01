import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

/**
 * COMM-001 — Communication Search API
 *
 * GET /api/communications/search?q=...
 *
 * Full-text search across subject, summary, and explanation.
 * Returns matching communications with parsed JSON fields.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    if (!q.trim()) {
      return success([]);
    }

    const communications = await db.employeeCommunication.findMany({
      where: {
        workspaceId,
        OR: [
          { subject: { contains: q } },
          { summary: { contains: q } },
          { explanation: { contains: q } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });

    const data = communications.map((c) => ({
      ...c,
      evidence: JSON.parse(c.evidence),
      attachments: JSON.parse(c.attachments),
      actionButtons: JSON.parse(c.actionButtons),
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
