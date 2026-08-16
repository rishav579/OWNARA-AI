import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { calculateDaysOverdue, calculateAgingBucket } from "@/lib/finance/domain";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");

    const where: any = { workspaceId };
    if (status && status !== "all") where.status = status;
    if (customerId) where.customerId = customerId;

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: { customer: true, payments: { where: { status: "completed" } }, reminders: true },
    });

    const data = invoices.map((inv) => {
      const daysOverdue = calculateDaysOverdue(inv.dueDate);
      const agingBucket = calculateAgingBucket(daysOverdue);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customer.name,
        customerEmail: inv.customer.email,
        customerRiskLevel: inv.customer.riskLevel,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        subtotal: inv.subtotal,
        tax: inv.tax,
        total: inv.total,
        amountPaid: inv.amountPaid,
        outstanding: inv.outstanding,
        status: inv.status,
        paymentTerms: inv.paymentTerms,
        daysOverdue,
        agingBucket,
        reminderCount: inv.reminders.length,
        paymentCount: inv.payments.length,
        notes: inv.notes,
        createdAt: inv.createdAt,
      };
    });

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { invoiceNumber, customerId, issueDate, dueDate, subtotal, tax, paymentTerms, notes } = body;

    // Check customer exists
    const customer = await db.customer.findFirst({ where: { id: customerId, workspaceId } });
    if (!customer) return error("NOT_FOUND", "Customer not found.", 404);

    const total = (subtotal || 0) + (tax || 0);
    const invoice = await db.invoice.create({
      data: {
        workspaceId,
        customerId,
        invoiceNumber,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        subtotal: subtotal || 0,
        tax: tax || 0,
        total,
        outstanding: total,
        status: "unpaid",
        paymentTerms: paymentTerms || customer.paymentTerms || 30,
        notes: notes || null,
        createdBy: user.id,
      },
    });

    return success({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      outstanding: invoice.outstanding,
      status: invoice.status,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
