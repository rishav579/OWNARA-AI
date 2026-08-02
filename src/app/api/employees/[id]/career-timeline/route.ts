import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { getCareerTimeline } from "@/lib/learning/engine";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const timeline = await getCareerTimeline(id, Math.min(200, Math.max(1, limit)));
    return success(timeline);
  } catch (err) {
    return handleApiError(err);
  }
}
