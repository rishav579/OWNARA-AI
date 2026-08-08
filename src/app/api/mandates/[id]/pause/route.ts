import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { transitionMandate } from "@/lib/mandate/engine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId, user } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await transitionMandate(id, "paused", user.id, body.reason);
    return success({ id, status: "paused" });
  } catch (err) {
    return handleApiError(err);
  }
}
