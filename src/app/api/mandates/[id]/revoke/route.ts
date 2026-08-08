import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { transitionMandate } from "@/lib/mandate/engine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireWorkspace(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await transitionMandate(id, "revoked", user.id, body.reason);
    return success({ id, status: "revoked" });
  } catch (err) {
    return handleApiError(err);
  }
}
