import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

// Business-readable activity feed — translates technical audit entries into business events
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const limit = parseInt(new URL(request.url).searchParams.get("limit") || "20");

    const entries = await db.auditLog.findMany({
      where: { workspaceId },
      orderBy: { sequenceNumber: "desc" },
      take: limit,
    });

    const data = entries.map((e) => {
      const payload = JSON.parse(e.payload);
      // Translate technical entryType + payload into business-readable text
      const business = translateToBusiness(e.entryType, e.actorName, e.actorType, payload, e.targetType);
      return {
        id: e.id,
        sequenceNumber: e.sequenceNumber,
        entryType: e.entryType,
        actorType: e.actorType,
        actorName: e.actorName,
        targetType: e.targetType,
        targetId: e.targetId,
        payload,
        businessEvent: business.event,
        businessDescription: business.description,
        category: business.category, // approval | task | employee | financial | policy | system
        severity: business.severity, // info | warning | critical | success
        createdAt: e.createdAt,
      };
    });

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

function translateToBusiness(
  entryType: string,
  actorName: string,
  actorType: string,
  payload: any,
  targetType: string | null
): { event: string; description: string; category: string; severity: string } {
  switch (entryType) {
    case "approval_requested":
      return {
        event: "Approval Required",
        description: `${actorName} requested approval to ${payload.tool?.replace(/_/g, " ") || "perform an action"}. ${payload.criticality === "critical" ? "This is a critical action." : ""}`,
        category: "approval",
        severity: payload.criticality === "critical" ? "warning" : "info",
      };
    case "approval_decided":
      if (payload.decision === "pending") {
        return {
          event: "Approval Under Review",
          description: `${actorName} is reviewing an approval request for ${payload.tool?.replace(/_/g, " ") || "an action"}.`,
          category: "approval",
          severity: "info",
        };
      }
      if (payload.decision === "approved") {
        return {
          event: "Action Approved",
          description: `${actorName} approved the ${payload.tool?.replace(/_/g, " ") || "action"} requested by ${payload.employee || "an AI Employee"}.`,
          category: "approval",
          severity: "success",
        };
      }
      if (payload.decision === "rejected") {
        return {
          event: "Action Rejected",
          description: `${actorName} rejected the ${payload.tool?.replace(/_/g, " ") || "action"} requested by ${payload.employee || "an AI Employee"}.`,
          category: "approval",
          severity: "warning",
        };
      }
      return {
        event: "Approval Modified",
        description: `${actorName} modified and approved the action requested by ${payload.employee || "an AI Employee"}.`,
        category: "approval",
        severity: "info",
      };
    case "task_started":
      return {
        event: "Work Delegated",
        description: `${actorName} assigned a new task to ${payload.employee}: "${payload.title}".`,
        category: "task",
        severity: "info",
      };
    case "task_completed":
      return {
        event: "Task Completed",
        description: `${payload.employee || "An AI Employee"} completed: "${payload.title || "a task"}".`,
        category: "task",
        severity: "success",
      };
    case "task_failed":
      return {
        event: "Task Failed",
        description: `${payload.employee || "An AI Employee"} failed to complete a task. ${payload.reason || "Manual review may be needed."}`,
        category: "task",
        severity: "critical",
      };
    case "step_executed":
      return {
        event: "Reasoning Step Logged",
        description: `${actorName} executed step ${payload.step} (${payload.type}). ${payload.tokens ? `${payload.tokens} tokens used.` : ""}`,
        category: "task",
        severity: "info",
      };
    case "tool_executed":
      return {
        event: "Tool Executed",
        description: `${actorName} executed the ${payload.tool?.replace(/_/g, " ")} tool. Status: ${payload.status}.`,
        category: "task",
        severity: "info",
      };
    case "llm_call":
      return {
        event: "AI Model Called",
        description: `LLM Gateway called ${payload.model} (${payload.tokens} tokens, ₹${(parseInt(payload.cost_cents || "0") / 100).toFixed(2)} cost).`,
        category: "system",
        severity: "info",
      };
    case "employee_created":
      return {
        event: "AI Employee Hired",
        description: `${actorName} hired a new AI Employee (${payload.employee}) for the ${payload.role?.replace(/_/g, " ")} role.`,
        category: "employee",
        severity: "success",
      };
    case "employee_paused":
      return {
        event: "AI Employee Paused",
        description: `${actorName} paused ${payload.employee}. The employee will not accept new tasks until resumed.`,
        category: "employee",
        severity: "warning",
      };
    case "employee_resumed":
      return {
        event: "AI Employee Resumed",
        description: `${actorName} resumed ${payload.employee}. The employee is now accepting tasks.`,
        category: "employee",
        severity: "success",
      };
    case "policy_violated":
      return {
        event: "Policy Violation Detected",
        description: `${actorName} triggered policy ${payload.policy_code}: ${payload.policy_name}. Action was ${payload.action_taken}.`,
        category: "policy",
        severity: "critical",
      };
    case "policy_checked":
      return {
        event: "Policy Compliance Verified",
        description: `${actorName} checked action against ${payload.policy_code}. Result: compliant.`,
        category: "policy",
        severity: "info",
      };
    case "refund_processed":
      return {
        event: "Refund Processed",
        description: `${actorName} processed a refund of ₹${(parseInt(payload.amount_cents) / 100).toFixed(2)} to ${payload.customer}.`,
        category: "financial",
        severity: "info",
      };
    default:
      return {
        event: entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `${actorName} (${actorType}) performed an action on ${targetType || "a resource"}.`,
        category: "system",
        severity: "info",
      };
  }
}
