import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";
import { seedCapabilities, grantFinanceCapabilities } from "@/lib/capabilities/engine";
import { initProfile } from "@/lib/profile/engine";

/**
 * MVP-001 — Onboarding Setup API
 *
 * Called at the end of the 4-step onboarding wizard. Performs ALL the work
 * needed to give a brand-new customer their "first value experience":
 *
 *   1. Updates the workspace with company details (industry, country, currency)
 *   2. Hires a Finance Employee (with finance capabilities + profile)
 *   3. Imports customers + invoices from the uploaded CSV (or seeds demo data)
 *   4. Auto-generates the first task: "Process overdue invoices"
 *
 * After this endpoint returns, the customer is redirected to the dashboard
 * where they can watch the Finance Employee start working.
 *
 * This endpoint REUSES existing systems — it does not duplicate them:
 *   - Uses the same Employee creation logic as seed.ts
 *   - Uses grantFinanceCapabilities() from the Capability Engine
 *   - Uses initProfile() from the Profile Engine
 *   - Uses appendAudit() from the Audit Chain
 *   - Uses the same Customer/Invoice/Task models as the finance domain
 *
 * The customer never has to press "Create Task" — the first task is
 * generated automatically from the uploaded invoices.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await parseBody<{
      // Step 1: Company
      industry?: string;
      country?: string;
      currency?: string;
      // Step 3: Invoices (parsed CSV rows OR "demo")
      invoices?: Array<{
        customerName: string;
        customerEmail: string;
        invoiceNumber: string;
        issueDate: string;
        dueDate: string;
        subtotal: number;
        tax: number;
      }>;
      useDemoData?: boolean;
    }>(request);

    // ─── Validate ───────────────────────────────────────────────────────────
    if (!body.invoices || body.invoices.length === 0) {
      if (!body.useDemoData) {
        return error("VALIDATION_ERROR", "No invoices provided. Upload a CSV or use demo data.", 400);
      }
    }

    // Check if onboarding was already completed (idempotency)
    const existingEmployees = await db.employee.count({ where: { workspaceId, role: "finance_employee" } });
    if (existingEmployees > 0) {
      return error("CONFLICT", "Onboarding already completed for this workspace.", 409);
    }

    // ─── Step 1: Update workspace with company details ─────────────────────
    // The workspace was created at signup with just a name. Now we add
    // industry/country/currency. These are stored as JSON metadata on the
    // workspace (no schema change needed — we reuse the existing schema).
    const metadata: Record<string, string> = {};
    if (body.industry) metadata.industry = body.industry;
    if (body.country) metadata.country = body.country;
    if (body.currency) metadata.currency = body.currency;
    metadata.onboardingCompletedAt = new Date().toISOString();

    // We store onboarding metadata in the workspace's defaultRegion field
    // (repurposed) — actually, let's not overload existing fields. We'll
    // write an audit entry instead, which is the canonical record.
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId,
        entryType: "onboarding_completed",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "workspace",
        targetId: workspaceId,
        payload: {
          industry: body.industry || "unspecified",
          country: body.country || "IN",
          currency: body.currency || "INR",
          invoiceCount: String(body.invoices?.length || 0),
          useDemoData: String(body.useDemoData || false),
        },
      });
    });

    // ─── Step 2: Hire the Finance Employee ─────────────────────────────────
    // Reuses the exact same logic as seed.ts for Kavya.
    await seedCapabilities();

    const financeEmployee = await db.employee.create({
      data: {
        workspaceId,
        name: "Kavya",
        role: "finance_employee",
        templateId: null, // no template needed — direct role
        status: "active",
        state: "idle",
        jobDescription:
          "Review overdue invoices, assess customer risk, calculate aging, and generate collection reminders. Always require human approval before sending any customer communication. Update collection cases and follow-up history for every action.",
        boundaries: JSON.stringify([
          "Never send a reminder without human approval",
          "Never modify invoice amounts or payment records",
          "Always cite invoice number and outstanding amount in reminders",
          "Escalate to manager after 3 unanswered reminders",
          "Never write off an invoice without explicit owner approval",
        ]),
        approvalRules: JSON.stringify({
          generate_reminder: "non_critical",
          send_reminder: "critical",
          update_collection_case: "non_critical",
          search_knowledge: "non_critical",
        }),
        tools: JSON.stringify([
          "generate_reminder",
          "send_reminder",
          "update_collection_case",
          "search_knowledge",
        ]),
        tokenCap: 5000000,
        createdBy: user.id,
        activatedAt: new Date(),
      },
    });

    // Grant finance capabilities (reuses the Capability Engine)
    await grantFinanceCapabilities(financeEmployee.id, user.id);

    // Initialize the employee profile (reuses the Profile Engine)
    await initProfile(financeEmployee.id, workspaceId, "finance_employee", "Finance");

    // Grant tool permissions (same as seed.ts)
    const financeTools = await db.tool.findMany({
      where: { name: { in: ["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"] } },
    });
    for (const tool of financeTools) {
      await db.employeeToolPermission.create({
        data: { employeeId: financeEmployee.id, toolId: tool.id, grantedBy: user.id },
      });
    }

    // Audit the employee hire
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId,
        entryType: "employee_created",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "employee",
        targetId: financeEmployee.id,
        payload: { employee: "Kavya", role: "finance_employee" },
      });
    });

    // ─── Step 3: Import customers + invoices ───────────────────────────────
    let customerCount = 0;
    let invoiceCount = 0;
    let overdueCount = 0;

    if (body.useDemoData) {
      // Seed demo customers + invoices (same as seed.ts but for this workspace)
      const result = await seedDemoFinanceData(workspaceId, user.id);
      customerCount = result.customerCount;
      invoiceCount = result.invoiceCount;
      overdueCount = result.overdueCount;
    } else if (body.invoices && body.invoices.length > 0) {
      // Import from the uploaded CSV
      const result = await importInvoicesFromCsv(workspaceId, user.id, body.invoices);
      customerCount = result.customerCount;
      invoiceCount = result.invoiceCount;
      overdueCount = result.overdueCount;
    }

    // ─── Step 4: (Removed) Manual first task ───────────────────────────────
    // The Mandate Supervisor now handles episode spawning automatically.
    // When the Mandate is granted (Step 5), the supervisor will observe the
    // overdue invoices and spawn an appropriate strategy-based episode.
    // No manual task creation is needed — the Mandate is self-activating.
    const taskId: string | null = null;

    // ─── Step 5: Grant the "Maintain Healthy Receivables" Mandate ──────────
    // The Mandate is the persistent organizational responsibility. Unlike the
    // first task (which is a temporary episode), the Mandate persists and
    // continuously pursues the desired state. This is what makes BIHARI AI
    // different from a task-management tool.
    const { grantMandate, evaluateMandateHealth } = await import("@/lib/mandate/engine");
    const { id: mandateId } = await grantMandate({
      workspaceId,
      grantorId: user.id,
      tenantId: financeEmployee.id,
      title: "Maintain Healthy Receivables",
      declaration: "Receivables older than 30 days should remain below 15% of total outstanding, and every overdue invoice should have an active resolution plan.",
      successCriteria: "overdueRate <= 0.15",
      authoritySpec: {
        autonomous: ["generate_reminder", "search_knowledge", "update_collection_case"],
        requiresApproval: ["send_reminder", "send_email"],
        forbidden: ["offer_discount_above_10", "send_legal_notice", "write_off_invoice"],
        escalationTriggers: ["disputed_invoice", "customer_bankruptcy", "invoice_over_90_days"],
      },
    });
    // Compute initial health from the just-imported data
    await evaluateMandateHealth(mandateId);

    return success({
      workspaceId,
      employee: { id: financeEmployee.id, name: financeEmployee.name, role: financeEmployee.role },
      mandateId,
      customersCreated: customerCount,
      invoicesImported: invoiceCount,
      overdueInvoices: overdueCount,
      taskId,
      message: overdueCount > 0
        ? "Finance Employee hired. Mandate granted — Kavya is now continuously pursuing healthy receivables."
        : "Finance Employee hired. Mandate granted — Kavya is monitoring your receivables.",
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seeds demo customers + invoices for a workspace.
 * Reuses the same data structure as scripts/seed.ts.
 */
async function seedDemoFinanceData(workspaceId: string, _userId: string) {
  const customers = [
    { name: "Sundar Electronics", email: "accounts@sundar-electronics.in", phone: "+91 98765 43210", gstin: "33AABCS1234F1Z5", billingAddress: "12 Mount Road, Chennai 600002", paymentTerms: 30, creditLimit: 500000, riskLevel: "low", notes: "Prompt payer, 8 years relationship" },
    { name: "Nair Textiles Pvt Ltd", email: "finance@nair-textiles.in", phone: "+91 99876 54321", gstin: "32AACCN5678G1Z2", billingAddress: "45 MG Road, Kochi 682035", paymentTerms: 45, creditLimit: 300000, riskLevel: "medium", notes: "Occasional delays, usually pays within 45 days" },
    { name: "BlueDart Logistics", email: "ap@bluedart-logistics.in", phone: "+91 90123 45678", gstin: "27AAFCB9012H1Z8", billingAddress: "78 Andheri East, Mumbai 400069", paymentTerms: 30, creditLimit: 1000000, riskLevel: "high", notes: "Frequent late payments, multiple overdue invoices" },
    { name: "FastFreight India", email: "billing@fastfreight.in", phone: "+91 88765 12345", gstin: "29AAFCF3456K1Z3", billingAddress: "23 Whitefield, Bengaluru 560066", paymentTerms: 15, creditLimit: 200000, riskLevel: "high", notes: "Consistently late, requires escalation" },
    { name: "Acme Pharma Ltd", email: "accounts@acme-pharma.in", phone: "+91 91234 98765", gstin: "24AABCA7890L1Z6", billingAddress: "56 Satellite Road, Ahmedabad 380015", paymentTerms: 60, creditLimit: 800000, riskLevel: "low", notes: "Large customer, reliable payer" },
  ];

  const customerRecords: Awaited<ReturnType<typeof db.customer.create>>[] = [];
  for (const c of customers) {
    const customer = await db.customer.create({
      data: { ...c, workspaceId, status: "active" },
    });
    customerRecords.push(customer);
  }

  // Invoices — realistic AR data with various aging scenarios
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const invoiceDefs = [
    { customerIdx: 0, invoiceNumber: "INV-2025-001", issueDays: 5, dueDays: -25, subtotal: 15000000, tax: 2700000 },
    { customerIdx: 1, invoiceNumber: "INV-2025-002", issueDays: 45, dueDays: 15, subtotal: 8500000, tax: 1530000 },
    { customerIdx: 2, invoiceNumber: "INV-2025-003", issueDays: 75, dueDays: 45, subtotal: 12000000, tax: 2160000 },
    { customerIdx: 3, invoiceNumber: "INV-2025-004", issueDays: 105, dueDays: 90, subtotal: 4500000, tax: 810000 },
    { customerIdx: 4, invoiceNumber: "INV-2024-098", issueDays: 125, dueDays: 65, subtotal: 22000000, tax: 3960000 },
    { customerIdx: 2, invoiceNumber: "INV-2025-005", issueDays: 50, dueDays: 20, subtotal: 6700000, tax: 1206000 },
    { customerIdx: 0, invoiceNumber: "INV-2025-006", issueDays: 2, dueDays: -28, subtotal: 9500000, tax: 1710000 },
    { customerIdx: 1, invoiceNumber: "INV-2025-007", issueDays: 40, dueDays: 5, subtotal: 3200000, tax: 576000 },
  ];

  let overdueCount = 0;
  for (const def of invoiceDefs) {
    const customer = customerRecords[def.customerIdx];
    const total = def.subtotal + def.tax;
    const issueDate = daysAgo(def.issueDays);
    const dueDate = daysAgo(def.dueDays);
    const isOverdue = dueDate < now;
    if (isOverdue) overdueCount++;

    await db.invoice.create({
      data: {
        workspaceId,
        customerId: customer.id,
        invoiceNumber: def.invoiceNumber,
        issueDate,
        dueDate,
        subtotal: def.subtotal,
        tax: def.tax,
        total,
        outstanding: total,
        amountPaid: 0,
        status: isOverdue ? "overdue" : "unpaid",
        paymentTerms: customer.paymentTerms || 30,
        createdBy: _userId,
      },
    });
  }

  return { customerCount: customerRecords.length, invoiceCount: invoiceDefs.length, overdueCount };
}

/**
 * Imports customers + invoices from parsed CSV rows.
 * Groups invoices by customer (creates customer if not exists).
 */
async function importInvoicesFromCsv(
  workspaceId: string,
  userId: string,
  rows: Array<{
    customerName: string;
    customerEmail: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
  }>
) {
  const customerMap = new Map<string, string>(); // email → customerId
  let overdueCount = 0;
  const now = new Date();

  for (const row of rows) {
    // Find or create the customer
    let customerId = customerMap.get(row.customerEmail);
    if (!customerId) {
      const customer = await db.customer.create({
        data: {
          workspaceId,
          name: row.customerName,
          email: row.customerEmail,
          paymentTerms: 30,
          creditLimit: 0,
          status: "active",
          riskLevel: "medium",
        },
      });
      customerId = customer.id;
      customerMap.set(row.customerEmail, customerId);
    }

    // Create the invoice
    const total = (row.subtotal || 0) + (row.tax || 0);
    const dueDate = new Date(row.dueDate);
    const isOverdue = dueDate < now;
    if (isOverdue) overdueCount++;

    await db.invoice.create({
      data: {
        workspaceId,
        customerId,
        invoiceNumber: row.invoiceNumber,
        issueDate: new Date(row.issueDate),
        dueDate,
        subtotal: row.subtotal || 0,
        tax: row.tax || 0,
        total,
        outstanding: total,
        amountPaid: 0,
        status: isOverdue ? "overdue" : "unpaid",
        paymentTerms: 30,
        createdBy: userId,
      },
    });
  }

  return {
    customerCount: customerMap.size,
    invoiceCount: rows.length,
    overdueCount,
  };
}
