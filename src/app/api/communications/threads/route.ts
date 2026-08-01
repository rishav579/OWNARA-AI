import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { getCommunicationThreads } from "@/lib/communication/engine";

/**
 * COMM-001 — Communication Threads API
 *
 * GET /api/communications/threads — list all threads with their latest message
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const threads = await getCommunicationThreads(workspaceId, Math.min(100, Math.max(1, limit)));

    // Parse JSON fields in the latest message
    const data = threads.map((t) => ({
      ...t,
      messages: t.messages.map((m: any) => ({
        ...m,
        evidence: JSON.parse(m.evidence),
        attachments: JSON.parse(m.attachments),
        actionButtons: JSON.parse(m.actionButtons),
      })),
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
