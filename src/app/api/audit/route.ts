import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { translateAuditEvent } from "@/lib/shared-helpers";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const entryType = url.searchParams.get("entryType");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = { workspaceId };
    if (entryType) where.entryType = entryType;

    const entries = await db.auditLog.findMany({
      where,
      orderBy: { sequenceNumber: "desc" },
      take: limit,
    });

    const data = entries.map((e) => {
      const payload = JSON.parse(e.payload);
      const business = translateAuditEvent(e.entryType, e.actorName, e.actorType, payload, e.targetType);
      return {
        id: e.id,
        sequenceNumber: e.sequenceNumber,
        entryType: e.entryType,
        actorType: e.actorType,
        actorId: e.actorId,
        actorName: e.actorName,
        targetType: e.targetType,
        targetId: e.targetId,
        payload,
        previousHash: e.previousHash,
        entryHash: e.entryHash,
        createdAt: e.createdAt,
        businessEvent: business.event,
        businessDescription: business.description,
        category: business.category,
        severity: business.severity,
        decision: payload.decision || null,
        reason: payload.reason || null,
        policyRef: payload.policy_code || payload.policy || null,
      };
    });

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

function translateBusiness(entryType: string, actorName: string, actorType: string, payload: any, targetType: string | null) {
  switch (entryType) {
    case "approval_requested":
      return { event: "Approval Required", description: `${actorName} requested approval to ${payload.tool?.replace(/_/g, " ") || "perform an action"}.`, category: "approval", severity: payload.criticality === "critical" ? "warning" : "info" };
    case "approval_decided":
      if (payload.decision === "approved") return { event: "Action Approved", description: `${actorName} approved the ${payload.tool?.replace(/_/g, " ") || "action"} for ${payload.employee || "an AI Employee"}.`, category: "approval", severity: "success" };
      if (payload.decision === "rejected") return { event: "Action Rejected", description: `${actorName} rejected the ${payload.tool?.replace(/_/g, " ") || "action"} for ${payload.employee || "an AI Employee"}.`, category: "approval", severity: "warning" };
      return { event: "Approval Under Review", description: `${actorName} is reviewing an approval request.`, category: "approval", severity: "info" };
    case "task_started":
      return { event: "Work Delegated", description: `${actorName} assigned "${payload.title}" to ${payload.employee}.`, category: "task", severity: "info" };
    case "task_completed":
      return { event: "Task Completed", description: `${payload.employee || "An AI Employee"} completed a task.`, category: "task", severity: "success" };
    case "tool_executed":
      return { event: "Tool Executed", description: `${actorName} used the ${payload.tool?.replace(/_/g, " ")} tool.`, category: "task", severity: "info" };
    case "llm_call":
      return { event: "AI Model Called", description: `LLM Gateway called ${payload.model} (${payload.tokens} tokens).`, category: "system", severity: "info" };
    case "employee_resumed":
      return { event: "AI Employee Resumed", description: `${actorName} resumed ${payload.employee}.`, category: "employee", severity: "success" };
    default:
      return { event: entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), description: `${actorName} performed an action on ${targetType || "a resource"}.`, category: "system", severity: "info" };
  }
}
