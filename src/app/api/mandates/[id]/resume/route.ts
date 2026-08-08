import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { transitionMandate } from "@/lib/mandate/engine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireWorkspace(request);
    const { id } = await params;
    await transitionMandate(id, "active", user.id);
    return success({ id, status: "active" });
  } catch (err) {
    return handleApiError(err);
  }
}
