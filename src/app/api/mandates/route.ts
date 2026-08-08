import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { grantMandate, type AuthoritySpec } from "@/lib/mandate/engine";

/**
 * GET /api/mandates?status=active
 *
 * Lists all Mandates in the workspace (optionally filtered by status).
 * Includes tenant + grantor + task counts for the list view.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const mandates = await db.mandate.findMany({
      where: {
        workspaceId,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, name: true, role: true, status: true, state: true } },
        grantor: { select: { id: true, name: true, avatarColor: true } },
        _count: { select: { tasks: true, childMandates: true, memory: true } },
      },
    });

    return success(mandates);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/mandates
 *
 * Grants a new Mandate — the act of entrusting a persistent organizational
 * responsibility to an AI tenant.
 *
 * Body:
 *   title, declaration, successCriteria, authoritySpec, tenantId?, parentMandateId?
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, user } = await requireWorkspace(request);
    const body = await request.json();

    const { title, declaration, successCriteria, authoritySpec, tenantId, parentMandateId } = body;

    if (!title || !declaration || !successCriteria) {
      return error("VALIDATION", "title, declaration, and successCriteria are required.", 400);
    }

    // Validate tenant belongs to workspace if provided
    if (tenantId) {
      const tenant = await db.employee.findFirst({ where: { id: tenantId, workspaceId } });
      if (!tenant) return error("NOT_FOUND", "Tenant (employee) not found in this workspace.", 404);
    }

    const spec: AuthoritySpec = {
      autonomous: Array.isArray(authoritySpec?.autonomous) ? authoritySpec.autonomous : [],
      requiresApproval: Array.isArray(authoritySpec?.requiresApproval) ? authoritySpec.requiresApproval : [],
      forbidden: Array.isArray(authoritySpec?.forbidden) ? authoritySpec.forbidden : [],
      escalationTriggers: Array.isArray(authoritySpec?.escalationTriggers) ? authoritySpec.escalationTriggers : [],
    };

    const { id } = await grantMandate({
      workspaceId,
      grantorId: user.id,
      title,
      declaration,
      successCriteria,
      authoritySpec: spec,
      tenantId,
      parentMandateId,
    });

    const mandate = await db.mandate.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, role: true, status: true, state: true } },
        grantor: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    return success(mandate, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
