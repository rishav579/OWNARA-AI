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
    if (employee.status !== "active") return error("CONFLICT", "Only active employees can be paused.", 409);

    const updated = await db.employee.update({
      where: { id },
      data: { status: "paused", priorState: employee.state, state: "paused" },
    });

    return success({ id: updated.id, status: updated.status, state: updated.state, priorState: updated.priorState });
  } catch (err) {
    return handleApiError(err);
  }
}
