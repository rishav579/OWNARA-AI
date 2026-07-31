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

    const reminders = await db.reminder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        invoice: { include: { customer: true } },
        customer: true,
      },
      take: 50,
    });

    const data = reminders.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoice.invoiceNumber,
      customerId: r.customerId,
      customerName: r.customer.name,
      customerEmail: r.customer.email,
      reminderType: r.reminderType,
      subject: r.subject,
      body: r.body,
      status: r.status,
      sentAt: r.sentAt,
      respondedAt: r.respondedAt,
      responseNotes: r.responseNotes,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}
