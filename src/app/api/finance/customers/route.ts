import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const where: any = { workspaceId };
    if (status && status !== "all") where.status = status;

    const customers = await db.customer.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        invoices: { select: { id: true, outstanding: true, status: true } },
      },
    });

    const data = customers.map((c) => {
      const totalOutstanding = c.invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
      const overdueCount = c.invoices.filter((i) => i.status === "overdue").length;
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        gstin: c.gstin,
        billingAddress: c.billingAddress,
        paymentTerms: c.paymentTerms,
        creditLimit: c.creditLimit,
        status: c.status,
        riskLevel: c.riskLevel,
        notes: c.notes,
        invoiceCount: c.invoices.length,
        totalOutstanding,
        overdueCount,
        createdAt: c.createdAt,
      };
    });

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
