import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const integrations = await db.integration.findMany({
      where: { workspaceId },
      orderBy: [{ status: "desc" }, { displayName: "asc" }],
    });

    const data = integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      displayName: i.displayName,
      category: i.category,
      description: i.description,
      status: i.status,
      logoColor: i.logoColor,
      connectedAt: i.connectedAt,
      connectedBy: i.connectedBy,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
