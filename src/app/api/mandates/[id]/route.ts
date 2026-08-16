import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { evaluateMandateHealth, parseAuthoritySpec, computeMandateOutcomeEconomics } from "@/lib/mandate/engine";

/**
 * GET /api/mandates/[id]
 *
 * Returns the full Mandate detail: declaration, authority, tenant, grantor,
 * memory, recent tasks, recent audit entries, and computed health.
 *
 * This is the data behind the Mandate Detail page — the experience that
 * answers "WHAT did I entrust to AI, and what has it done with that trust?"
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const mandate = await db.mandate.findFirst({
      where: { id, workspaceId },
      include: {
        tenant: { select: { id: true, name: true, role: true, status: true, state: true, jobDescription: true } },
        grantor: { select: { id: true, name: true, avatarColor: true, email: true } },
        parentMandate: { select: { id: true, title: true } },
        childMandates: {
          select: { id: true, title: true, status: true, healthScore: true },
          orderBy: { createdAt: "desc" },
        },
        memory: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, status: true, createdAt: true, completedAt: true, stepCount: true },
        },
        _count: { select: { tasks: true, childMandates: true, memory: true } },
      },
    });

    if (!mandate) return error("NOT_FOUND", "Mandate not found.", 404);

    // Recent audit entries for this mandate
    const auditEntries = await db.auditLog.findMany({
      where: { workspaceId, targetType: "mandate", targetId: id },
      orderBy: { sequenceNumber: "desc" },
      take: 15,
    });

    // Parsed authority for the UI
    const authority = parseAuthoritySpec(mandate.authoritySpec);

    // Outcome economics — the distinction between activity and outcome
    const economics = await computeMandateOutcomeEconomics(id);

    return success({ ...mandate, authority, auditEntries, economics });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/mandates/[id]
 *
 * Re-evaluates the Mandate's health on demand (query param ?action=evaluate).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    const mandate = await db.mandate.findFirst({ where: { id, workspaceId } });
    if (!mandate) return error("NOT_FOUND", "Mandate not found.", 404);

    if (action === "evaluate") {
      await evaluateMandateHealth(id);
      const updated = await db.mandate.findUnique({ where: { id } });
      return success(updated);
    }

    return error("VALIDATION", "Unknown action. Use ?action=evaluate.", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
