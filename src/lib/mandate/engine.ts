/**
 * BIHARI AI — Mandate Engine
 *
 * The core logic for the Mandate primitive: a persistent, self-executing,
 * authority-bearing, outcome-bound, accountable unit of organizational intent.
 *
 * This module is the single source of truth for:
 *   - Granting a Mandate (proposed → granted → active)
 *   - Lifecycle transitions (pause, resume, resolve, revoke, breach)
 *   - Tenant reassignment (the central test: the Mandate outlives the tenant)
 *   - Authority enforcement (is an action autonomous, approval-required, or forbidden?)
 *   - Health computation (how well is the desired state being maintained?)
 *
 * The Mandate is NOT a task. A task is imperative and one-shot. A Mandate is
 * declarative and continuous — it pursues a DESIRED STATE, not a single action,
 * and it persists until that state is sustained.
 */

import { db } from "@/lib/db";
import { appendAudit } from "@/lib/runtime/audit";

export interface AuthoritySpec {
  /** Actions the tenant may take WITHOUT human approval. */
  autonomous: string[];
  /** Actions that REQUIRE human approval before execution. */
  requiresApproval: string[];
  /** Actions that are FORBIDDEN — the tenant must never take them. */
  forbidden: string[];
  /** Conditions that force escalation to a human (e.g. disputed_invoice). */
  escalationTriggers: string[];
}

export const MANDATE_STATUSES = [
  "proposed",
  "granted",
  "active",
  "paused",
  "resolved",
  "revoked",
  "breached",
] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];

export const TERMINAL_STATUSES: MandateStatus[] = ["resolved", "revoked", "breached"];

export function parseAuthoritySpec(spec: string): AuthoritySpec {
  try {
    const parsed = JSON.parse(spec);
    return {
      autonomous: Array.isArray(parsed.autonomous) ? parsed.autonomous : [],
      requiresApproval: Array.isArray(parsed.requiresApproval) ? parsed.requiresApproval : [],
      forbidden: Array.isArray(parsed.forbidden) ? parsed.forbidden : [],
      escalationTriggers: Array.isArray(parsed.escalationTriggers) ? parsed.escalationTriggers : [],
    };
  } catch {
    return { autonomous: [], requiresApproval: [], forbidden: [], escalationTriggers: [] };
  }
}

/**
 * Determines whether an action is within the Mandate's authority, and if so,
 * whether it may proceed autonomously or needs human approval.
 *
 * Returns:
 *   - { allowed: true, mode: "autonomous" }  — proceed without approval
 *   - { allowed: true, mode: "approval" }    — create an approval gate
 *   - { allowed: false, mode: "forbidden" }  — the action violates the Mandate
 *
 * This is the enforcement of the boundary of trust. It is called before EVERY
 * tool execution by the executor.
 */
export function checkAuthority(
  authoritySpec: string,
  action: string
): { allowed: boolean; mode: "autonomous" | "approval" | "forbidden" } {
  const spec = parseAuthoritySpec(authoritySpec);

  if (spec.forbidden.includes(action)) {
    return { allowed: false, mode: "forbidden" };
  }
  if (spec.requiresApproval.includes(action)) {
    return { allowed: true, mode: "approval" };
  }
  if (spec.autonomous.includes(action)) {
    return { allowed: true, mode: "autonomous" };
  }
  // Default: if the action isn't explicitly listed, require approval (safe default).
  return { allowed: true, mode: "approval" };
}

export interface GrantMandateInput {
  workspaceId: string;
  grantorId: string;
  title: string;
  declaration: string;
  successCriteria: string;
  authoritySpec: AuthoritySpec;
  tenantId?: string;
  parentMandateId?: string;
}

/**
 * Grants a Mandate: creates it with status "active" and a tenant assigned.
 *
 * This is the act of ENTRUSTING — a human declares a desired state, confers
 * authority, and assigns an AI tenant to pursue it continuously. The audit
 * chain records the grant as the origin of the Mandate's accountable body.
 */
export async function grantMandate(input: GrantMandateInput): Promise<{ id: string }> {
  const mandate = await db.$transaction(async (tx) => {
    const m = await tx.mandate.create({
      data: {
        workspaceId: input.workspaceId,
        grantorId: input.grantorId,
        title: input.title,
        declaration: input.declaration,
        successCriteria: input.successCriteria,
        authoritySpec: JSON.stringify(input.authoritySpec),
        tenantId: input.tenantId ?? null,
        parentMandateId: input.parentMandateId ?? null,
        status: input.tenantId ? "active" : "granted",
        healthScore: 100,
        lastEvaluatedAt: new Date(),
      },
    });

    await appendAudit(tx, {
      workspaceId: input.workspaceId,
      entryType: "mandate_granted",
      actorType: "user",
      actorId: input.grantorId,
      actorName: "Grantor",
      targetType: "mandate",
      targetId: m.id,
      payload: {
        title: input.title,
        declaration: input.declaration,
        tenantId: input.tenantId || "unassigned",
      },
    });

    return m;
  });

  return { id: mandate.id };
}

/**
 * Reassigns the tenant of a Mandate. This is the CENTRAL TEST of the
 * Mandate architecture: the Mandate must survive tenant replacement with its
 * declaration, authority, memory, ledger, outcome history, and lifecycle intact.
 *
 * What is preserved (NOT reset):
 *   - declaration, successCriteria, authoritySpec, version
 *   - MandateMemory (scoped to the Mandate, not the tenant)
 *   - AuditLog (the ledger — append-only)
 *   - OutcomeEvaluation history (reputation)
 *   - Tasks (historical episodes)
 *   - lifecycle status (unless the old tenant was paused)
 *
 * What changes:
 *   - tenantId → new tenant
 *   - an audit entry records the reassignment
 *
 * The new tenant INHERITS the Mandate's accumulated context. A 3-year-old
 * collections Mandate reassigned to a fresh tenant still carries 3 years of
 * customer patterns, approval feedback, and outcome lessons.
 */
export async function reassignMandateTenant(
  mandateId: string,
  newTenantId: string,
  actorId: string,
  reason?: string
): Promise<void> {
  const mandate = await db.mandate.findUnique({
    where: { id: mandateId },
    select: { id: true, workspaceId: true, tenantId: true, title: true, status: true },
  });
  if (!mandate) throw new Error("Mandate not found");
  if (TERMINAL_STATUSES.includes(mandate.status as MandateStatus)) {
    throw new Error(`Cannot reassign a ${mandate.status} Mandate`);
  }

  await db.$transaction(async (tx) => {
    await tx.mandate.update({
      where: { id: mandateId },
      data: { tenantId: newTenantId },
    });

    await appendAudit(tx, {
      workspaceId: mandate.workspaceId,
      entryType: "mandate_tenant_reassigned",
      actorType: "user",
      actorId: actorId,
      actorName: "Grantor",
      targetType: "mandate",
      targetId: mandateId,
      payload: {
        fromTenant: mandate.tenantId || "unassigned",
        toTenant: newTenantId,
        reason: reason || "Tenant replaced",
        preserved: "declaration,authority,memory,ledger,outcomes,lifecycle",
      },
    });
  });
}

/**
 * Transitions a Mandate's lifecycle status. Validates the transition is legal.
 */
export async function transitionMandate(
  mandateId: string,
  newStatus: MandateStatus,
  actorId: string,
  note?: string
): Promise<void> {
  const mandate = await db.mandate.findUnique({
    where: { id: mandateId },
    select: { id: true, workspaceId: true, status: true },
  });
  if (!mandate) throw new Error("Mandate not found");
  if (TERMINAL_STATUSES.includes(mandate.status as MandateStatus)) {
    throw new Error(`Cannot transition a terminal (${mandate.status}) Mandate`);
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: newStatus };
  if (newStatus === "paused") data.pausedAt = now;
  if (newStatus === "resolved") data.resolvedAt = now;
  if (newStatus === "revoked") data.revokedAt = now;
  if (newStatus === "breached") data.breachedAt = now;
  if (note) data.resolutionNote = note;

  await db.$transaction(async (tx) => {
    await tx.mandate.update({ where: { id: mandateId }, data });
    const entryType =
      newStatus === "paused" ? "mandate_paused"
      : newStatus === "active" ? "mandate_resumed"
      : `mandate_${newStatus}`;
    await appendAudit(tx, {
      workspaceId: mandate.workspaceId,
      entryType,
      actorType: "user",
      actorId,
      actorName: "Grantor",
      targetType: "mandate",
      targetId: mandateId,
      payload: { from: mandate.status, to: newStatus, note: note || "" },
    });
  });
}

/**
 * Appends a memory entry to a Mandate. Memory is scoped to the MANDATE, so it
 * survives tenant replacement — the new tenant inherits this context.
 */
export async function appendMandateMemory(
  mandateId: string,
  memoryType: string,
  content: string,
  sourceType?: string,
  sourceId?: string,
  importance = 0.5
): Promise<void> {
  await db.mandateMemory.create({
    data: { mandateId, memoryType, content, sourceType, sourceId, importance },
  });
}

/**
 * Computes a Mandate's health score from the live finance domain data.
 *
 * For a "Maintain Healthy Receivables" mandate, health is based on the overdue
 * rate vs the success criteria. This is a deterministic, evidence-first
 * computation — no LLM guessing. The score is what makes the Mandate's outcome
 * MEASURABLE and the primitive feel real.
 *
 * Returns { score, note } where score is 0-100.
 */
export async function computeMandateHealth(
  mandateId: string
): Promise<{ score: number; note: string }> {
  const mandate = await db.mandate.findUnique({
    where: { id: mandateId },
    select: { workspaceId: true, successCriteria: true, title: true },
  });
  if (!mandate) return { score: 0, note: "Mandate not found" };

  // Compute the live overdue rate from invoices
  const invoices = await db.invoice.findMany({
    where: { workspaceId: mandate.workspaceId, status: { in: ["sent", "overdue", "partial", "unpaid"] } },
    select: { total: true, outstanding: true, status: true, dueDate: true },
  });

  const totalOutstanding = invoices.reduce((s, i) => s + (i.outstanding || 0), 0);
  const now = new Date();
  const overdueInvoices = invoices.filter(
    (i) => i.status === "overdue" || (i.dueDate && new Date(i.dueDate) < now && i.outstanding > 0)
  );
  const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.outstanding || 0), 0);

  if (totalOutstanding === 0) {
    return { score: 100, note: "No outstanding receivables — desired state fully met." };
  }

  const overdueRate = overdueAmount / totalOutstanding;

  // Parse target from successCriteria (e.g. "overdueRate <= 0.15")
  const match = mandate.successCriteria.match(/overdueRate\s*<=\s*([0-9.]+)/i);
  const target = match ? parseFloat(match[1]) : 0.15;

  // Score: at-or-below target = 100; linear decay to 0 at 3x target.
  let score: number;
  if (overdueRate <= target) {
    score = 100;
  } else {
    score = Math.max(0, Math.round(100 * (1 - (overdueRate - target) / (target * 2))));
  }

  const pct = (overdueRate * 100).toFixed(1);
  const targetPct = (target * 100).toFixed(0);
  const note =
    score >= 100
      ? `Overdue rate ${pct}% — at or below the ${targetPct}% target. Desired state maintained.`
      : `Overdue rate ${pct}% exceeds the ${targetPct}% target. ${overdueInvoices.length} invoices need attention.`;

  return { score, note };
}

/**
 * Updates a Mandate's health score in the database. Called by the Mandate
 * Supervisor on each evaluation cycle.
 */
export async function evaluateMandateHealth(mandateId: string): Promise<void> {
  const { score, note } = await computeMandateHealth(mandateId);
  await db.mandate.update({
    where: { id: mandateId },
    data: { healthScore: score, healthNote: note, lastEvaluatedAt: new Date() },
  });
}
