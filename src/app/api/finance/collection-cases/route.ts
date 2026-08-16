import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { calculateDaysOverdue, calculateAgingBucket } from "@/lib/finance/domain";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const cases = await db.collectionCase.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "desc" }, { openedAt: "desc" }],
      include: {
        invoice: { include: { customer: true } },
        customer: true,
        followUps: { orderBy: { performedAt: "desc" } },
      },
    });

    const data = cases.map((c) => ({
      id: c.id,
      invoiceId: c.invoiceId,
      invoiceNumber: c.invoice.invoiceNumber,
      customerId: c.customerId,
      customerName: c.customer.name,
      customerEmail: c.customer.email,
      outstanding: c.invoice.outstanding,
      status: c.status,
      priority: c.priority,
      agingBucket: c.agingBucket,
      daysOverdue: c.daysOverdue,
      escalationLevel: c.escalationLevel,
      assignedTo: c.assignedTo,
      resolution: c.resolution,
      openedAt: c.openedAt,
      resolvedAt: c.resolvedAt,
      followUpCount: c.followUps.length,
      lastFollowUp: c.followUps[0] ? {
        action: c.followUps[0].action,
        description: c.followUps[0].description,
        performedAt: c.followUps[0].performedAt,
      } : null,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
