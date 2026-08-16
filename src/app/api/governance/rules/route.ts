import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const rules = await db.approvalRule.findMany({
      where: { workspaceId },
      orderBy: { priority: "desc" },
    });

    const data = rules.map((r) => ({
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      condition: JSON.parse(r.condition),
      action: r.action,
      approverRole: r.approverRole,
      policyId: r.policyId,
      priority: r.priority,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { name, trigger, condition, action, approverRole, priority } = body;

    const rule = await db.approvalRule.create({
      data: {
        workspaceId,
        name,
        trigger,
        condition: JSON.stringify(condition || {}),
        action: action || "require_approval",
        approverRole: approverRole || "owner",
        priority: priority || 100,
        status: "active",
      },
    });

    return success({ id: rule.id, name: rule.name, status: rule.status }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
