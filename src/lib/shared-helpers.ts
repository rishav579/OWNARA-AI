/**
 * OWNARA — Shared API Helpers
 *
 * Single source of truth for constants and helpers used across API routes.
 * Eliminates the duplicate AVATAR_COLORS, ROLE_LABELS, and translateBusiness
 * that were copy-pasted across 8+ route files.
 */

// ─── Avatar Colors ───────────────────────────────────────────────────────────

export const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
  Kavya: "#06b6d4",
};

export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name] || "#10b981";
}

// ─── Role Labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  customer_support_agent: "Customer Support Agent",
  sales_development_representative: "Sales Development Rep",
  research_analyst: "Research Analyst",
  finance_employee: "Finance Employee",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Audit Event Translation ─────────────────────────────────────────────────

export interface BusinessTranslation {
  event: string;
  description: string;
  category: string;  // approval | task | employee | financial | policy | system
  severity: string;  // info | warning | critical | success
}

/**
 * Translates a raw audit entryType + payload into business-readable text.
 * Single implementation — used by dashboard, audit, and business-activity routes.
 */
export function translateAuditEvent(
  entryType: string,
  actorName: string,
  actorType: string,
  payload: any,
  targetType: string | null
): BusinessTranslation {
  switch (entryType) {
    case "approval_requested":
      return {
        event: "Approval Required",
        description: `${actorName} requested approval to ${payload.tool?.replace(/_/g, " ") || "perform an action"}.`,
        category: "approval",
        severity: payload.criticality === "critical" ? "warning" : "info",
      };
    case "approval_decided":
      if (payload.decision === "approved") {
        return {
          event: "Action Approved",
          description: `${actorName} approved the ${payload.tool?.replace(/_/g, " ") || "action"} for ${payload.employee || "an AI Employee"}.`,
          category: "approval",
          severity: "success",
        };
      }
      if (payload.decision === "rejected") {
        return {
          event: "Action Rejected",
          description: `${actorName} rejected the ${payload.tool?.replace(/_/g, " ") || "action"} for ${payload.employee || "an AI Employee"}.`,
          category: "approval",
          severity: "warning",
        };
      }
      return {
        event: "Approval Under Review",
        description: `${actorName} is reviewing an approval request.`,
        category: "approval",
        severity: "info",
      };
    case "task_started":
      return {
        event: "Work Delegated",
        description: `${actorName} assigned "${payload.title}" to ${payload.employee}.`,
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
    case "task_paused":
      return {
        event: "Task Paused",
        description: `${actorName} paused a task. ${payload.reason || ""}`,
        category: "task",
        severity: "warning",
      };
    case "step_executed":
      return {
        event: "Reasoning Step Logged",
        description: `${actorName} executed step ${payload.step} (${payload.type}).`,
        category: "task",
        severity: "info",
      };
    case "tool_executed":
      return {
        event: "Action Executed",
        description: `${actorName} executed the ${payload.tool?.replace(/_/g, " ")} action. Status: ${payload.status}.`,
        category: "task",
        severity: "info",
      };
    case "reminder_drafted":
      return {
        event: "Reminder Drafted",
        description: `${actorName} drafted a reminder for invoice ${payload.invoiceNumber || ""}.`,
        category: "task",
        severity: "info",
      };
    case "reminder_sent":
      return {
        event: "Reminder Sent",
        description: `${actorName} sent a reminder to ${payload.customer || "a customer"}.`,
        category: "task",
        severity: "success",
      };
    case "reminder_approved":
      return {
        event: "Reminder Approved",
        description: `${actorName} approved sending a reminder.`,
        category: "approval",
        severity: "success",
      };
    case "collection_case_updated":
      return {
        event: "Collection Case Updated",
        description: `${actorName} updated a collection case.`,
        category: "task",
        severity: "info",
      };
    case "employee_created":
      return {
        event: "AI Employee Hired",
        description: `${actorName} hired a new AI Employee (${payload.employee}) for the ${payload.role?.replace(/_/g, " ") || ""} role.`,
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
    case "plan_created":
      return {
        event: "Task Plan Created",
        description: `${actorName} created an execution plan with ${payload.steps || ""} steps.`,
        category: "task",
        severity: "info",
      };
    case "communication_created":
      return {
        event: "Communication Sent",
        description: `${actorName} sent a ${payload.communicationType?.replace(/_/g, " ") || ""} message.`,
        category: "system",
        severity: "info",
      };
    case "communication_resolved":
      return {
        event: "Communication Resolved",
        description: `A communication was resolved by ${actorName}.`,
        category: "system",
        severity: "success",
      };
    case "onboarding_completed":
      return {
        event: "Workspace Onboarded",
        description: `${actorName} completed workspace onboarding.`,
        category: "system",
        severity: "success",
      };
    case "demo_workspace_created":
      return {
        event: "Demo Workspace Created",
        description: `A demo workspace was created.`,
        category: "system",
        severity: "info",
      };
    case "profile_updated":
      return {
        event: "Profile Updated",
        description: `Employee profile was updated.`,
        category: "employee",
        severity: "info",
      };
    case "skill_promoted":
      return {
        event: "Skill Improved",
        description: `Skill "${payload.skillName}" improved to Level ${payload.newLevel}.`,
        category: "employee",
        severity: "success",
      };
    case "pattern_learned":
      return {
        event: "Pattern Learned",
        description: `A new pattern was detected: ${payload.pattern?.replace(/_/g, " ") || ""}.`,
        category: "system",
        severity: "info",
      };
    case "strength_detected":
      return {
        event: "Strength Identified",
        description: `A strength was identified: ${payload.strengthType?.replace(/_/g, " ") || ""}.`,
        category: "employee",
        severity: "success",
      };
    case "weakness_detected":
      return {
        event: "Improvement Area Identified",
        description: `An improvement area was identified: ${payload.weaknessType?.replace(/_/g, " ") || ""}.`,
        category: "employee",
        severity: "warning",
      };
    case "achievement_unlocked":
      return {
        event: "Milestone Reached",
        description: `Milestone: ${payload.name || ""}. ${payload.evidence || ""}`,
        category: "employee",
        severity: "success",
      };
    case "capability_denied":
      return {
        event: "Capability Denied",
        description: `${actorName} was denied the ${payload.tool?.replace(/_/g, " ") || ""} capability.`,
        category: "policy",
        severity: "critical",
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
