import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { getProfile } from "@/lib/profile/engine";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const employee = await db.employee.findFirst({ where: { id, workspaceId } });
    if (!employee) return error("NOT_FOUND", "Employee not found.", 404);

    const profile = await getProfile(id);
    if (!profile) return error("NOT_FOUND", "Profile not found. Initialize the employee first.", 404);

    return success(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
