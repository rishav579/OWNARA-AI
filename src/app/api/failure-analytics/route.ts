import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { getFailureAnalytics } from "@/lib/learning/engine";

/**
 * GET /api/failure-analytics
 * GET /api/failure-analytics?employeeId=<id>
 *
 * Returns aggregated failure analytics: total tasks, total failures,
 * failure rate, and breakdowns by failure type, category, and severity.
 *
 * Used by the dashboard and employee profile to surface structured
 * failure data — the foundation of enterprise trust reports.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId") || undefined;

    const analytics = await getFailureAnalytics(employeeId, workspaceId);
    return success(analytics);
  } catch (err) {
    return handleApiError(err);
  }
}
