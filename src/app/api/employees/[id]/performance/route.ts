import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { getPerformance } from "@/lib/profile/engine";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    const performance = await getPerformance(id);
    if (!performance) return error("NOT_FOUND", "Performance data not found.", 404);

    return success(performance);
  } catch (err) {
    return handleApiError(err);
  }
}
