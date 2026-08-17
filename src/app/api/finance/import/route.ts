import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";

/**
 * POST /api/finance/import
 *
 * CSV import for invoices, customers, and payments.
 *
 * Accepts a JSON body with:
 *   { rows: ParsedCsvRow[], dataType: "invoices" | "customers" | "payments" }
 *
 * Where ParsedCsvRow maps to the domain model fields.
 *
 * Requirements implemented:
 *   - validation (required fields, type checking)
 *   - duplicate handling (skip existing invoice numbers / customer emails)
 *   - clear import result (success count, skip count, error count)
 *   - failed-row reporting (row index + error message)
 *   - workspace isolation (all records tagged with workspaceId)
 *   - audit log for import
 *   - safe parsing (no silent corruption — invalid rows are rejected, not stored)
 *
 * This is the minimum reliable ingestion path for MVP 1.
 */

interface InvoiceRow {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
}

interface CustomerRow {
  name: string;
  email: string;
  phone?: string;
  gstin?: string;
  paymentTerms?: number;
  creditLimit?: number;
  riskLevel?: string;
}

interface PaymentRow {
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  method?: string;
  reference?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  errorRows: Array<{ row: number; error: string }>;
}

/**
 * Robust date parser supporting ISO (YYYY-MM-DD), Indian/UK (DD/MM/YYYY, DD-MM-YYYY),
 * and standard timestamp formats.
 */
export function parseFlexibleDate(raw: string): Date {
  if (!raw || typeof raw !== "string") {
    throw new Error("Date must be a non-empty string");
  }
  const trimmed = raw.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date values in "${raw}" (day: ${day}, month: ${month})`);
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date values in "${raw}"`);
    }
    return d;
  }

  // Standard ISO / Timestamp
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: "${raw}". Expected YYYY-MM-DD, DD/MM/YYYY, or ISO timestamp.`);
  }
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { rows, dataType } = body as { rows: any[]; dataType: "invoices" | "customers" | "payments" };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return error("VALIDATION", "No rows provided for import.", 400);
    }
    if (!["invoices", "customers", "payments"].includes(dataType)) {
      return error("VALIDATION", "dataType must be 'invoices', 'customers', or 'payments'.", 400);
    }
    if (rows.length > 500) {
      return error("VALIDATION", "Maximum 500 rows per import.", 400);
    }

    let result: ImportResult;

    if (dataType === "invoices") {
      result = await importInvoices(workspaceId, user.id, rows as InvoiceRow[]);
    } else if (dataType === "customers") {
      result = await importCustomers(workspaceId, user.id, rows as CustomerRow[]);
    } else {
      result = await importPayments(workspaceId, user.id, rows as PaymentRow[]);
    }

    // Audit the import
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId,
        entryType: "csv_import",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "workspace",
        targetId: workspaceId,
        payload: {
          dataType,
          imported: String(result.imported),
          skipped: String(result.skipped),
          errors: String(result.errors),
        },
      });
    });

    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}

async function importInvoices(workspaceId: string, userId: string, rows: InvoiceRow[]): Promise<ImportResult> {
  let imported = 0, skipped = 0, errors = 0;
  const errorRows: Array<{ row: number; error: string }> = [];

  // Pre-load existing customers to avoid N+1 queries
  const existingCustomers = await db.customer.findMany({ where: { workspaceId }, select: { id: true, email: true, name: true } });
  const customerByEmail = new Map(existingCustomers.map((c) => [c.email.toLowerCase(), c]));
  const customerByName = new Map(existingCustomers.map((c) => [c.name.toLowerCase(), c]));

  // Pre-load existing invoice numbers to detect duplicates
  const existingInvoiceNumbers = new Set(
    (await db.invoice.findMany({ where: { workspaceId }, select: { invoiceNumber: true } })).map((i) => i.invoiceNumber)
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is the header

    try {
      // ─── Validation ──────────────────────────────────────────────────────
      if (!row.customerName || !row.customerEmail || !row.invoiceNumber || !row.issueDate || !row.dueDate) {
        throw new Error("Missing required field (customerName, customerEmail, invoiceNumber, issueDate, dueDate)");
      }
      if (typeof row.subtotal !== "number" || row.subtotal < 0) {
        throw new Error("subtotal must be a non-negative number");
      }
      if (typeof row.tax !== "number" || row.tax < 0) {
        throw new Error("tax must be a non-negative number");
      }

      // ─── Duplicate handling ──────────────────────────────────────────────
      if (existingInvoiceNumbers.has(row.invoiceNumber)) {
        skipped++;
        continue;
      }

      // ─── Find or create customer ─────────────────────────────────────────
      let customer = customerByEmail.get(row.customerEmail.toLowerCase()) || customerByName.get(row.customerName.toLowerCase());
      if (!customer) {
        customer = await db.customer.create({
          data: {
            workspaceId,
            name: row.customerName,
            email: row.customerEmail,
            status: "active",
            riskLevel: "medium",
            paymentTerms: 30,
          },
        });
        customerByEmail.set(row.customerEmail.toLowerCase(), customer);
        customerByName.set(row.customerName.toLowerCase(), customer);
      }

      // ─── Create invoice ──────────────────────────────────────────────────
      const total = Math.round(row.subtotal + row.tax);
      const issueDate = parseFlexibleDate(row.issueDate);
      const dueDate = parseFlexibleDate(row.dueDate);

      const now = new Date();
      const isOverdue = dueDate < now;

      await db.invoice.create({
        data: {
          workspaceId,
          customerId: customer.id,
          invoiceNumber: row.invoiceNumber,
          issueDate,
          dueDate,
          subtotal: Math.round(row.subtotal),
          tax: Math.round(row.tax),
          total,
          amountPaid: 0,
          outstanding: total,
          status: isOverdue ? "overdue" : "sent",
          createdBy: userId,
        },
      });

      existingInvoiceNumbers.add(row.invoiceNumber);
      imported++;
    } catch (err) {
      errors++;
      errorRows.push({ row: rowNum, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, skipped, errors, errorRows };
}

async function importCustomers(workspaceId: string, userId: string, rows: CustomerRow[]): Promise<ImportResult> {
  let imported = 0, skipped = 0, errors = 0;
  const errorRows: Array<{ row: number; error: string }> = [];

  const existingEmails = new Set(
    (await db.customer.findMany({ where: { workspaceId }, select: { email: true } })).map((c) => c.email.toLowerCase())
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      if (!row.name || !row.email) {
        throw new Error("Missing required field (name, email)");
      }
      if (existingEmails.has(row.email.toLowerCase())) {
        skipped++;
        continue;
      }

      await db.customer.create({
        data: {
          workspaceId,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
          gstin: row.gstin || null,
          paymentTerms: row.paymentTerms || 30,
          creditLimit: row.creditLimit || 0,
          riskLevel: row.riskLevel || "medium",
          status: "active",
        },
      });

      existingEmails.add(row.email.toLowerCase());
      imported++;
    } catch (err) {
      errors++;
      errorRows.push({ row: rowNum, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, skipped, errors, errorRows };
}

async function importPayments(workspaceId: string, userId: string, rows: PaymentRow[]): Promise<ImportResult> {
  let imported = 0, skipped = 0, errors = 0;
  const errorRows: Array<{ row: number; error: string }> = [];

  // Pre-load invoices by invoice number
  const invoices = await db.invoice.findMany({ where: { workspaceId }, select: { id: true, invoiceNumber: true, outstanding: true, total: true, amountPaid: true } });
  const invoiceByNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      if (!row.invoiceNumber || typeof row.amount !== "number" || !row.paymentDate) {
        throw new Error("Missing required field (invoiceNumber, amount, paymentDate)");
      }
      if (row.amount <= 0) {
        throw new Error("amount must be positive");
      }

      const invoice = invoiceByNumber.get(row.invoiceNumber);
      if (!invoice) {
        throw new Error(`Invoice ${row.invoiceNumber} not found`);
      }

      const paymentDate = parseFlexibleDate(row.paymentDate);

      const customer = await db.invoice.findUnique({ where: { id: invoice.id }, select: { customerId: true } });

      await db.payment.create({
        data: {
          workspaceId,
          invoiceId: invoice.id,
          customerId: customer!.customerId,
          amount: Math.round(row.amount),
          paymentDate,
          method: row.method || "bank_transfer",
          reference: row.reference || null,
          status: "completed",
          recordedBy: userId,
        },
      });

      // Update invoice outstanding balance
      const newAmountPaid = invoice.amountPaid + Math.round(row.amount);
      const newOutstanding = Math.max(0, invoice.total - newAmountPaid);
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          outstanding: newOutstanding,
          status: newOutstanding === 0 ? "paid" : newOutstanding < invoice.total ? "partially_paid" : undefined,
        },
      });

      imported++;
    } catch (err) {
      errors++;
      errorRows.push({ row: rowNum, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { imported, skipped, errors, errorRows };
}
