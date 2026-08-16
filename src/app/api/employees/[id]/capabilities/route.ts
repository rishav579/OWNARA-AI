import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { getEmployeeCapabilities, grantCapability, revokeCapability } from "@/lib/capabilities/engine";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    const capabilities = await getEmployeeCapabilities(id);
    return success(capabilities);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const body = await parseBody<{ capabilityCode: string }>(request);

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    await grantCapability(id, body.capabilityCode, user.id);
    return success({ employeeId: id, capabilityCode: body.capabilityCode, granted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const url = new URL(request.url);
    const capabilityCode = url.searchParams.get("code");

    if (!capabilityCode) return error("VALIDATION_ERROR", "Capability code is required as ?code= parameter.", 400);

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    await revokeCapability(id, capabilityCode);
    return success({ employeeId: id, capabilityCode, revoked: true });
  } catch (err) {
    return handleApiError(err);
  }
}
