/**
 * BIHARI AI — Capability Engine
 *
 * Enterprise-grade least-privilege authorization. Every tool execution
 * in BIHARI AI must pass through capability verification before execution.
 *
 * Architecture:
 * - Capabilities are system-defined (e.g., "invoice.read", "reminder.send")
 * - EmployeeCapabilities link employees to capabilities (granted by a human)
 * - Before any tool executes, the runtime checks if the employee has the
 *   required capability
 * - If denied: execution stops, audit event is written, contract event is
 *   created, and the error surfaces in the Decision Center
 *
 * This is NOT finance-specific. Any future employee (HR, Sales, Legal) uses
 * the same capability system.
 */

import { db } from "@/lib/db";
import { appendAudit } from "@/lib/runtime/audit";

// ─── Tool → Capability Mapping ───────────────────────────────────────────────

/**
 * Maps each tool name to the capability code it requires.
 * This is the single source of truth for "what capability does this tool need?"
 */
const TOOL_CAPABILITY_MAP: Record<string, string> = {
  // Generic tools
  search_knowledge: "knowledge.read",
  draft_response: "response.draft",
  send_email: "email.send",
  summarize: "content.summarize",

  // Finance tools
  generate_reminder: "reminder.generate",
  send_reminder: "reminder.send",
  update_collection_case: "collection_case.update",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CapabilityCheckResult {
  allowed: boolean;
  capabilityCode: string;
  capabilityName: string;
  reason: string;
}

// ─── Core: Check Capability ─────────────────────────────────────────────────

/**
 * Verifies that an employee has the capability required to execute a tool.
 *
 * Called BEFORE every tool execution in the executor.
 * If the capability is missing, the executor stops execution, writes an
 * audit event, and surfaces the error.
 */
export async function checkCapability(
  employeeId: string,
  toolName: string
): Promise<CapabilityCheckResult> {
  const requiredCapabilityCode = TOOL_CAPABILITY_MAP[toolName];

  // If the tool is not in the map, allow it (backward compatibility)
  if (!requiredCapabilityCode) {
    return {
      allowed: true,
      capabilityCode: "none",
      capabilityName: "No capability required",
      reason: `Tool "${toolName}" does not require a capability`,
    };
  }

  const capability = await db.capability.findUnique({
    where: { code: requiredCapabilityCode },
  });

  if (!capability) {
    return {
      allowed: true,
      capabilityCode: requiredCapabilityCode,
      capabilityName: "Unknown (not defined)",
      reason: `Capability "${requiredCapabilityCode}" is not defined — allowing by default`,
    };
  }

  const employeeCapability = await db.employeeCapability.findUnique({
    where: {
      employeeId_capabilityId: {
        employeeId,
        capabilityId: capability.id,
      },
    },
  });

  if (!employeeCapability) {
    return {
      allowed: false,
      capabilityCode: capability.code,
      capabilityName: capability.name,
      reason: `Employee does not have the "${capability.code}" capability required to execute "${toolName}"`,
    };
  }

  return {
    allowed: true,
    capabilityCode: capability.code,
    capabilityName: capability.name,
    reason: `Employee has the "${capability.code}" capability`,
  };
}

/**
 * Records a capability denial as an audit event.
 * Called when a tool execution is blocked due to missing capability.
 */
export async function recordCapabilityDenial(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  workspaceId: string,
  employeeId: string,
  employeeName: string,
  toolName: string,
  checkResult: CapabilityCheckResult
): Promise<void> {
  await appendAudit(tx, {
    workspaceId,
    entryType: "capability_denied",
    actorType: "system",
    actorId: null,
    actorName: "Capability Engine",
    targetType: "employee",
    targetId: employeeId,
    payload: {
      tool: toolName,
      requiredCapability: checkResult.capabilityCode,
      capabilityName: checkResult.capabilityName,
      reason: checkResult.reason,
      employee: employeeName,
    },
  });
}

// ─── Capability Management ───────────────────────────────────────────────────

export async function grantCapability(
  employeeId: string,
  capabilityCode: string,
  grantedBy: string
): Promise<void> {
  const capability = await db.capability.findUnique({
    where: { code: capabilityCode },
  });
  if (!capability) throw new Error(`Capability not found: ${capabilityCode}`);

  await db.employeeCapability.upsert({
    where: {
      employeeId_capabilityId: { employeeId, capabilityId: capability.id },
    },
    create: { employeeId, capabilityId: capability.id, grantedBy },
    update: { grantedBy },
  });
}

export async function revokeCapability(
  employeeId: string,
  capabilityCode: string
): Promise<void> {
  const capability = await db.capability.findUnique({
    where: { code: capabilityCode },
  });
  if (!capability) return;

  await db.employeeCapability.deleteMany({
    where: { employeeId, capabilityId: capability.id },
  });
}

export async function getEmployeeCapabilities(employeeId: string) {
  const grants = await db.employeeCapability.findMany({
    where: { employeeId },
    include: { capability: true },
  });
  return grants.map((g) => ({
    id: g.id,
    capabilityId: g.capabilityId,
    code: g.capability.code,
    name: g.capability.name,
    description: g.capability.description,
    category: g.capability.category,
    riskLevel: g.capability.riskLevel,
    grantedBy: g.grantedBy,
    createdAt: g.createdAt,
  }));
}

export async function getAllCapabilities() {
  const capabilities = await db.capability.findMany({
    orderBy: { category: "asc" },
  });
  return capabilities.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    category: c.category,
    riskLevel: c.riskLevel,
    createdAt: c.createdAt,
  }));
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

export const FINANCE_CAPABILITIES = [
  { code: "invoice.read", name: "Read Invoices", description: "View invoice details, aging, and outstanding balances", category: "finance", riskLevel: "low" },
  { code: "invoice.update", name: "Update Invoices", description: "Update invoice status and notes", category: "finance", riskLevel: "medium" },
  { code: "customer.read", name: "Read Customers", description: "View customer profiles, risk levels, and payment history", category: "finance", riskLevel: "low" },
  { code: "reminder.generate", name: "Generate Reminders", description: "Draft collection reminder emails for review", category: "finance", riskLevel: "low" },
  { code: "reminder.send", name: "Send Reminders", description: "Send collection reminders to customers (requires approval)", category: "finance", riskLevel: "high" },
  { code: "collection_case.update", name: "Update Collection Cases", description: "Create and update collection cases with follow-up history", category: "finance", riskLevel: "medium" },
  { code: "knowledge.read", name: "Read Knowledge", description: "Search and retrieve knowledge documents", category: "data_access", riskLevel: "low" },
  { code: "response.draft", name: "Draft Responses", description: "Draft responses for review without sending", category: "communication", riskLevel: "low" },
  { code: "email.send", name: "Send Emails", description: "Send emails on behalf of the employee (requires approval)", category: "communication", riskLevel: "high" },
  { code: "content.summarize", name: "Summarize Content", description: "Summarize long content into briefs", category: "system", riskLevel: "low" },
];

export const RESTRICTED_CAPABILITIES = [
  { code: "payment.refund", name: "Process Refunds", description: "Process customer refunds (restricted — requires owner approval)", category: "finance", riskLevel: "critical" },
  { code: "ledger.edit", name: "Edit Ledger", description: "Modify the general ledger (restricted)", category: "finance", riskLevel: "critical" },
  { code: "invoice.delete", name: "Delete Invoices", description: "Permanently delete invoices (restricted)", category: "finance", riskLevel: "critical" },
];

export async function seedCapabilities(): Promise<void> {
  const all = [...FINANCE_CAPABILITIES, ...RESTRICTED_CAPABILITIES];
  for (const cap of all) {
    await db.capability.upsert({
      where: { code: cap.code },
      create: cap,
      update: { name: cap.name, description: cap.description, category: cap.category, riskLevel: cap.riskLevel },
    });
  }
}

export async function grantFinanceCapabilities(employeeId: string, grantedBy: string): Promise<void> {
  for (const cap of FINANCE_CAPABILITIES) {
    await grantCapability(employeeId, cap.code, grantedBy);
  }
}
