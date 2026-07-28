import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);
    if (employee.status !== "paused") return error("CONFLICT", "Only paused employees can be resumed.", 409);

    const updated = await db.employee.update({
      where: { id },
      data: { status: "active", state: employee.priorState || "idle", priorState: null },
    });

    return success({ id: updated.id, status: updated.status, state: updated.state, priorState: null });
  } catch (err) {
    return handleApiError(err);
  }
}
