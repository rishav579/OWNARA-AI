import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { loadInvoiceContext } from "@/lib/finance/domain";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const { id } = await params;

    const invoice = await db.invoice.findFirst({
      where: { id, workspaceId },
      include: {
        customer: true,
        payments: { orderBy: { paymentDate: "desc" } },
        reminders: { orderBy: { createdAt: "desc" } },
        collectionCases: { include: { followUps: true }, orderBy: { openedAt: "desc" } },
      },
    });

    if (!invoice) return error("NOT_FOUND", "Invoice not found.", 404);

    // Load computed context (aging, priority, recommended action)
    const ctx = await loadInvoiceContext(id);

    return success({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: {
        id: invoice.customer.id,
        name: invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        gstin: invoice.customer.gstin,
        riskLevel: invoice.customer.riskLevel,
        paymentTerms: invoice.customer.paymentTerms,
      },
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      outstanding: invoice.outstanding,
      status: invoice.status,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
        status: p.status,
      })),
      reminders: invoice.reminders.map((r) => ({
        id: r.id,
        reminderType: r.reminderType,
        subject: r.subject,
        body: r.body,
        status: r.status,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
      })),
      collectionCases: invoice.collectionCases.map((c) => ({
        id: c.id,
        status: c.status,
        priority: c.priority,
        agingBucket: c.agingBucket,
        daysOverdue: c.daysOverdue,
        escalationLevel: c.escalationLevel,
        openedAt: c.openedAt,
        resolvedAt: c.resolvedAt,
        followUps: c.followUps.map((f) => ({
          id: f.id,
          action: f.action,
          description: f.description,
          performedAt: f.performedAt,
        })),
      })),
      // Finance domain context (computed)
      financeContext: ctx ? {
        daysOverdue: ctx.daysOverdue,
        agingBucket: ctx.agingBucket,
        previousReminderCount: ctx.previousReminderCount,
        recommendedAction: ctx.recommendedAction,
        collectionPriority: ctx.collectionPriority,
        businessReason: ctx.businessReason,
      } : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
