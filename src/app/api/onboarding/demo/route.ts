import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, error, handleApiError, parseBody } from "@/lib/api-response";
import { hashPassword, signAccessToken, signRefreshToken } from "@/lib/auth";
import { appendAudit } from "@/lib/runtime/audit";
import { seedCapabilities, grantFinanceCapabilities } from "@/lib/capabilities/engine";
import { initProfile } from "@/lib/profile/engine";

/**
 * MVP-001 — Demo Mode API
 *
 * Creates a complete demo company in one shot:
 *   - Demo user (demo+timestamp@bihari.ai)
 *   - Demo workspace ("Demo Company Pvt Ltd")
 *   - Finance Employee (Kavya)
 *   - 5 sample customers + 8 sample invoices (various aging)
 *   - Finance capabilities + profile initialized
 *   - First task auto-generated ("Process overdue invoices")
 *
 * Returns access + refresh tokens so the frontend can log in immediately.
 *
 * This endpoint is PUBLIC (no auth required) — it creates a new account.
 * It's idempotent per-email: if the demo email already exists, it returns
 * the existing workspace's tokens instead of creating a duplicate.
 *
 * This REUSES the existing architecture:
 *   - Same User/Workspace/WorkspaceMember creation as signup
 *   - Same Finance Employee creation as seed.ts
 *   - Same Customer/Invoice models as the finance domain
 *   - Same Task creation as the tasks API
 *   - Same audit chain, capability engine, profile engine
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody<{ email?: string; password?: string; workspaceName?: string }>(request).catch(() => ({}));

    // Generate unique demo credentials (or use provided ones)
    const timestamp = Date.now().toString().slice(-6);
    const email = body.email || `demo${timestamp}@bihari.ai`;
    const password = body.password || "demo-password";
    const workspaceName = body.workspaceName || "Demo Company Pvt Ltd";

    // Check if this demo email already exists — if so, just log in
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      // Log in to the existing demo workspace
      const membership = await db.workspaceMember.findFirst({
        where: { userId: existingUser.id, status: "active" },
        include: { workspace: true },
      });
      if (!membership) {
        return error("NOT_FOUND", "Demo workspace not found.", 404);
      }

      const accessToken = signAccessToken({
        sub: existingUser.id,
        email: existingUser.email,
        workspaceId: membership.workspaceId,
        role: membership.role,
      });
      const refreshToken = signRefreshToken({
        sub: existingUser.id,
        email: existingUser.email,
        workspaceId: membership.workspaceId,
        role: membership.role,
      });

      // Create a session (consistent with auth.ts login route)
      const bcrypt = await import("bcryptjs");
      const sessionTokenHash = await bcrypt.hash(refreshToken, 10);

      await db.session.create({
        data: {
          userId: existingUser.id,
          tokenHash: sessionTokenHash,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return success({
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          emailVerifiedAt: existingUser.emailVerifiedAt,
          status: existingUser.status,
          avatarColor: existingUser.avatarColor,
        },
        workspace: { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug },
        accessToken,
        refreshToken,
        expiresIn: 900,
        isExistingDemo: true,
      });
    }

    // ─── Create the demo company ───────────────────────────────────────────
    const passwordHash = await hashPassword(password);
    const slug = `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}`;

    // Create user + workspace + membership in a transaction
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: "Demo User",
          emailVerifiedAt: new Date(),
          status: "active",
          avatarColor: "#10b981",
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug,
          ownerUserId: user.id,
          defaultRegion: "in-central",
          status: "active",
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        },
      });

      await appendAudit(tx, {
        workspaceId: workspace.id,
        entryType: "demo_workspace_created",
        actorType: "system",
        actorId: null,
        actorName: "Demo Mode",
        targetType: "workspace",
        targetId: workspace.id,
        payload: { email, workspaceName },
      });

      return { user, workspace };
    });

    const { user, workspace } = result;

    // ─── Hire the Finance Employee ─────────────────────────────────────────
    await seedCapabilities();

    const financeEmployee = await db.employee.create({
      data: {
        workspaceId: workspace.id,
        name: "Kavya",
        role: "finance_employee",
        templateId: null,
        status: "active",
        state: "idle",
        jobDescription:
          "Review overdue invoices, assess customer risk, calculate aging, and generate collection reminders. Always require human approval before sending any customer communication.",
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
        tools: JSON.stringify(["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"]),
        tokenCap: 5000000,
        createdBy: user.id,
        activatedAt: new Date(),
      },
    });

    await grantFinanceCapabilities(financeEmployee.id, user.id);
    await initProfile(financeEmployee.id, workspace.id, "finance_employee", "Finance");

    // Grant tool permissions
    const financeTools = await db.tool.findMany({
      where: { name: { in: ["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"] } },
    });
    for (const tool of financeTools) {
      await db.employeeToolPermission.create({
        data: { employeeId: financeEmployee.id, toolId: tool.id, grantedBy: user.id },
      });
    }

    // ─── Seed demo customers + invoices ────────────────────────────────────
    const customers = [
      { name: "Sundar Electronics", email: "accounts@sundar-electronics.in", phone: "+91 98765 43210", gstin: "33AABCS1234F1Z5", billingAddress: "12 Mount Road, Chennai 600002", paymentTerms: 30, creditLimit: 500000, riskLevel: "low", notes: "Prompt payer, 8 years relationship" },
      { name: "Nair Textiles Pvt Ltd", email: "finance@nair-textiles.in", phone: "+91 99876 54321", gstin: "32AACCN5678G1Z2", billingAddress: "45 MG Road, Kochi 682035", paymentTerms: 45, creditLimit: 300000, riskLevel: "medium", notes: "Occasional delays, usually pays within 45 days" },
      { name: "BlueDart Logistics", email: "ap@bluedart-logistics.in", phone: "+91 90123 45678", gstin: "27AAFCB9012H1Z8", billingAddress: "78 Andheri East, Mumbai 400069", paymentTerms: 30, creditLimit: 1000000, riskLevel: "high", notes: "Frequent late payments, multiple overdue invoices" },
      { name: "FastFreight India", email: "billing@fastfreight.in", phone: "+91 88765 12345", gstin: "29AAFCF3456K1Z3", billingAddress: "23 Whitefield, Bengaluru 560066", paymentTerms: 15, creditLimit: 200000, riskLevel: "high", notes: "Consistently late, requires escalation" },
      { name: "Acme Pharma Ltd", email: "accounts@acme-pharma.in", phone: "+91 91234 98765", gstin: "24AABCA7890L1Z6", billingAddress: "56 Satellite Road, Ahmedabad 380015", paymentTerms: 60, creditLimit: 800000, riskLevel: "low", notes: "Large customer, reliable payer" },
    ];

    const customerRecords = [];
    for (const c of customers) {
      const customer = await db.customer.create({
        data: { ...c, workspaceId: workspace.id, status: "active" },
      });
      customerRecords.push(customer);
    }

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    const invoiceDefs = [
      { customerIdx: 0, invoiceNumber: `INV-${timestamp}-001`, issueDays: 5, dueDays: -25, subtotal: 15000000, tax: 2700000 },
      { customerIdx: 1, invoiceNumber: `INV-${timestamp}-002`, issueDays: 45, dueDays: 15, subtotal: 8500000, tax: 1530000 },
      { customerIdx: 2, invoiceNumber: `INV-${timestamp}-003`, issueDays: 75, dueDays: 45, subtotal: 12000000, tax: 2160000 },
      { customerIdx: 3, invoiceNumber: `INV-${timestamp}-004`, issueDays: 105, dueDays: 90, subtotal: 4500000, tax: 810000 },
      { customerIdx: 4, invoiceNumber: `INV-${timestamp}-098`, issueDays: 125, dueDays: 65, subtotal: 22000000, tax: 3960000 },
      { customerIdx: 2, invoiceNumber: `INV-${timestamp}-005`, issueDays: 50, dueDays: 20, subtotal: 6700000, tax: 1206000 },
      { customerIdx: 0, invoiceNumber: `INV-${timestamp}-006`, issueDays: 2, dueDays: -28, subtotal: 9500000, tax: 1710000 },
      { customerIdx: 1, invoiceNumber: `INV-${timestamp}-007`, issueDays: 40, dueDays: 5, subtotal: 3200000, tax: 576000 },
    ];

    let overdueCount = 0;
    for (const def of invoiceDefs) {
      const customer = customerRecords[def.customerIdx];
      const total = def.subtotal + def.tax;
      const dueDate = daysAgo(def.dueDays);
      const isOverdue = dueDate < now;
      if (isOverdue) overdueCount++;

      await db.invoice.create({
        data: {
          workspaceId: workspace.id,
          customerId: customer.id,
          invoiceNumber: def.invoiceNumber,
          issueDate: daysAgo(def.issueDays),
          dueDate,
          subtotal: def.subtotal,
          tax: def.tax,
          total,
          outstanding: total,
          amountPaid: 0,
          status: isOverdue ? "overdue" : "unpaid",
          paymentTerms: customer.paymentTerms || 30,
          createdBy: user.id,
        },
      });
    }

    // ─── Auto-generate the first task ──────────────────────────────────────
    if (overdueCount > 0) {
      await db.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            workspaceId: workspace.id,
            employeeId: financeEmployee.id,
            assignedBy: user.id,
            title: "Process overdue invoices",
            description: `Review ${overdueCount} overdue invoice(s), calculate aging, generate appropriate reminders, and send after human approval.`,
            status: "queued",
            priority: "high",
            stepCap: 20,
            tokenCap: 100000,
            tokenUsage: 0,
            startedAt: new Date(),
          },
        });

        await tx.employee.update({
          where: { id: financeEmployee.id },
          data: { state: "assigned", taskCount: { increment: 1 } },
        });

        await appendAudit(tx, {
          workspaceId: workspace.id,
          entryType: "task_started",
          actorType: "user",
          actorId: user.id,
          actorName: user.name,
          targetType: "task",
          targetId: task.id,
          payload: {
            title: task.title,
            employee: financeEmployee.name,
            steps: "0",
            tokens: "0",
          },
        });
      });
    }

    // ─── Issue tokens ──────────────────────────────────────────────────────
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role: "owner",
    });
    const refreshToken = signRefreshToken({
      sub: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role: "owner",
    });

    const bcrypt = await import("bcryptjs");
    const sessionTokenHash = await bcrypt.hash(refreshToken, 10);

    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionTokenHash,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return success({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerifiedAt: user.emailVerifiedAt,
        status: user.status,
        avatarColor: user.avatarColor,
      },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      accessToken,
      refreshToken,
      expiresIn: 900,
      isExistingDemo: false,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
