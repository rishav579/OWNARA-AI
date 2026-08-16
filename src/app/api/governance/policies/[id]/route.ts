import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json();

    const policy = await db.policy.findFirst({ where: { id, workspaceId } });
    if (!policy) return error("NOT_FOUND", "Policy not found.", 404);

    const updated = await db.policy.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.rules ? { rules: JSON.stringify(body.rules) } : {}),
        ...(body.severity ? { severity: body.severity } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.appliesTo ? { appliesTo: body.appliesTo } : {}),
      },
    });

    return success({ id: updated.id, name: updated.name, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const policy = await db.policy.findFirst({ where: { id, workspaceId } });
    if (!policy) return error("NOT_FOUND", "Policy not found.", 404);

    // Archive instead of hard delete
    const updated = await db.policy.update({
      where: { id },
      data: { status: "archived" },
    });

    return success({ id: updated.id, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}
