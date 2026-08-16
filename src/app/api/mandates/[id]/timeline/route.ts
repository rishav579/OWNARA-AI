import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

/**
 * GET /api/mandates/[id]/timeline
 *
 * Returns a compact chronological timeline of business + AI events for a Mandate.
 *
 * This is a VISUALIZATION layer — it pulls existing events from the audit log,
 * tasks, reminders, payments, and health evaluations. It does NOT invent events.
 *
 * The timeline answers: "What happened in the business, and what did the AI do about it?"
 *
 * Each event includes:
 *   - timestamp
 *   - type
 *   - title (human-readable)
 *   - description
 *   - evidenceType (activity vs outcome vs lifecycle)
 *   - simulated (boolean — true for mock transport, seeded data)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const mandate = await db.mandate.findFirst({ where: { id, workspaceId } });
    if (!mandate) return error("NOT_FOUND", "Mandate not found.", 404);

    const events: TimelineEvent[] = [];

    // 1. Audit entries for this mandate + its tasks
    const tasks = await db.task.findMany({
      where: { mandateId: id },
      select: { id: true, title: true, status: true, createdAt: true, completedAt: true, priority: true },
    });
    const taskIds = tasks.map((t) => t.id);

    const auditWhere = {
      workspaceId,
      OR: [
        { targetType: "mandate", targetId: id },
        ...(taskIds.length > 0 ? [{ targetType: "task", targetId: { in: taskIds } }] : []),
        ...(taskIds.length > 0 ? [{ targetType: "task_step", targetId: { in: taskIds } }] : []),
      ],
    };
    const auditEntries = await db.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "asc" },
    });

    for (const a of auditEntries) {
      const payload = typeof a.payload === "string" ? JSON.parse(a.payload) : a.payload;
      events.push({
        id: a.id,
        timestamp: a.createdAt,
        type: a.entryType,
        title: auditTitle(a.entryType, payload),
        description: auditDescription(a.entryType, payload),
        evidenceType: auditEvidenceType(a.entryType),
        simulated: false,
      });
    }

    // 2. Reminders sent (evidence of execution — mock vs real)
    const reminders = await db.reminder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    for (const r of reminders) {
      if (r.sentAt) {
        const isMock = r.status === "sent_mock";
        events.push({
          id: `reminder-${r.id}`,
          timestamp: r.sentAt,
          type: "reminder_sent",
          title: isMock ? `Reminder sent (MOCK TRANSPORT)` : `Reminder sent`,
          description: `Invoice ${r.invoice.invoiceNumber}: ${r.subject}`,
          evidenceType: "activity",
          simulated: isMock,
        });
      }
    }

    // 3. Payments received (business outcome — NOT caused by AI, just observed)
    const payments = await db.payment.findMany({
      where: { workspaceId },
      orderBy: { paymentDate: "asc" },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    for (const p of payments) {
      events.push({
        id: `payment-${p.id}`,
        timestamp: p.paymentDate,
        type: "payment_received",
        title: `Payment received: ₹${(p.amount / 100).toLocaleString("en-IN")}`,
        description: `Invoice ${p.invoice.invoiceNumber} — DEMO DATA (seeded payment, not caused by AI)`,
        evidenceType: "outcome",
        simulated: true,
      });
    }

    // 4. Current health (latest evaluation)
    if (mandate.lastEvaluatedAt) {
      events.push({
        id: `health-${mandate.id}`,
        timestamp: mandate.lastEvaluatedAt,
        type: "health_evaluated",
        title: `Mandate health: ${Math.round(mandate.healthScore)}%`,
        description: mandate.healthNote || "",
        evidenceType: "outcome",
        simulated: false,
      });
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return success(events);
  } catch (err) {
    return handleApiError(err);
  }
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: string;
  title: string;
  description: string;
  evidenceType: "activity" | "outcome" | "lifecycle";
  simulated: boolean;
}

function auditTitle(entryType: string, payload: any): string {
  const titles: Record<string, string> = {
    mandate_granted: "Mandate granted",
    mandate_episode_spawned: `Episode spawned: ${payload.strategy || "strategy"}`,
    mandate_paused: "Mandate paused",
    mandate_resumed: "Mandate resumed",
    mandate_revoked: "Mandate revoked",
    mandate_tenant_reassigned: "Tenant replaced",
    task_started: "Episode started",
    task_completed: "Episode completed",
    task_failed: "Episode failed",
    step_executed: `Step executed: ${payload.type || payload.step || ""}`,
    approval_requested: "Approval requested",
    approval_decided: `Approval ${payload.decision || "decided"}`,
    csv_import: `CSV import: ${payload.imported || 0} rows`,
  };
  return titles[entryType] || entryType.replace(/_/g, " ");
}

function auditDescription(entryType: string, payload: any): string {
  if (entryType === "mandate_episode_spawned") {
    return payload.reasoning || `Strategy: ${payload.strategy || "unknown"}`;
  }
  if (entryType === "mandate_tenant_reassigned") {
    return `From ${payload.fromTenant} to ${payload.toTenant}. ${payload.preserved || "All context preserved."}`;
  }
  if (entryType === "approval_decided") {
    return payload.reason || `Decision: ${payload.decision}`;
  }
  if (entryType === "step_executed") {
    return `Step ${payload.step}, type: ${payload.type}, tokens: ${payload.tokens}`;
  }
  return "";
}

function auditEvidenceType(entryType: string): "activity" | "outcome" | "lifecycle" {
  if (entryType.startsWith("mandate_")) return "lifecycle";
  if (entryType === "csv_import" || entryType.includes("payment")) return "outcome";
  return "activity";
}
