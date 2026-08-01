import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { getAllCapabilities } from "@/lib/capabilities/engine";

export async function GET(request: NextRequest) {
  try {
    await requireWorkspace(request);
    const capabilities = await getAllCapabilities();
    return success(capabilities);
  } catch (err) {
    return handleApiError(err);
  }
}
