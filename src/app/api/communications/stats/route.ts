import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { getCommunicationStats } from "@/lib/communication/engine";

/**
 * COMM-001 — Communication Stats API
 *
 * GET /api/communications/stats — aggregate stats for the Communication Center
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const stats = await getCommunicationStats(workspaceId);
    return success(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
