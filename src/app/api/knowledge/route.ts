import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const employeeId = url.searchParams.get("employeeId");

    const where: any = { workspaceId };
    if (status && status !== "all") where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const docs = await db.knowledgeDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true, uploader: true },
    });

    const data = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      chunkCount: d.chunkCount,
      employeeId: d.employeeId,
      employeeName: d.employee?.name || null,
      uploadedBy: d.uploader.name,
      createdAt: d.createdAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { filename, contentType, sizeBytes, employeeId } = body;

    const doc = await db.knowledgeDocument.create({
      data: {
        workspaceId,
        employeeId: employeeId || null,
        filename,
        contentType,
        sizeBytes,
        storageKey: `ws/${workspaceId}/doc/${filename}`,
        status: "processing",
        uploadedBy: user.id,
      },
    });

    return success({
      id: doc.id,
      filename: doc.filename,
      status: doc.status,
      createdAt: doc.createdAt,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
