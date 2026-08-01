// BIHARI AI — Database seed script (clean V1)
// Run with: bun run scripts/seed.ts
//
// Seeds ONLY infrastructure: user, workspace, templates, tools, employees,
// knowledge documents. No tasks, steps, approvals, audit logs, or notifications.
// Those are generated LIVE by the runtime when the user creates tasks.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BIHARI AI database (clean V1 — no fake execution data)...");

  // Clean slate — wipe everything (order matters for FK constraints)
  // Delete child tables first, then parent tables
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.llmUsage.deleteMany();
  await db.knowledgeDocument.deleteMany();
  await db.employeeToolPermission.deleteMany();
  await db.taskStep.deleteMany();
  await db.approval.deleteMany();
  await db.task.deleteMany();
  // Execution contracts
  await db.executionContract.deleteMany();
  // Capabilities
  await db.employeeCapability.deleteMany();
  await db.capability.deleteMany();
  // Finance tables
  await db.followUpHistory.deleteMany();
  await db.collectionCase.deleteMany();
  await db.reminder.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.customer.deleteMany();
  // Employee memory (must be before employee)
  await db.employeeMemory.deleteMany();
  // Trust/governance
  try { await db.trustScore.deleteMany(); } catch {}
  await db.employee.deleteMany();
  await db.tool.deleteMany();
  await db.employeeTemplate.deleteMany();
  try { await db.policy.deleteMany(); } catch {}
  try { await db.approvalRule.deleteMany(); } catch {}
  try { await db.department.deleteMany(); } catch {}
  try { await db.integration.deleteMany(); } catch {}
  await db.session.deleteMany();
  await db.workspaceMember.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();

  // ─── User ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo-password", 10);
  const rohit = await db.user.create({
    data: {
      email: "rohit@acmetrading.in",
      passwordHash,
      name: "Rohit Sharma",
      emailVerifiedAt: new Date(),
      status: "active",
      avatarColor: "#10b981",
    },
  });
  console.log("  ✓ Created user: Rohit Sharma");

  // ─── Workspace ────────────────────────────────────────────────────────────
  const workspace = await db.workspace.create({
    data: {
      name: "Acme Trading Pvt Ltd",
      slug: "acme-trading",
      ownerUserId: rohit.id,
      defaultRegion: "in-central",
      status: "active",
    },
  });
  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: rohit.id,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    },
  });
  console.log("  ✓ Created workspace: Acme Trading");

  // ─── Templates ────────────────────────────────────────────────────────────
  const csaTemplate = await db.employeeTemplate.create({
    data: {
      name: "Customer Support Agent",
      role: "customer_support_agent",
      description: "Drafts and routes customer replies under human approval.",
      defaultJobDescription:
        "Draft replies to customer queries about orders, returns, and product information. Route complex billing issues to the finance team. Always ground responses in the returns policy and FAQ documents.",
      defaultApprovalRules: JSON.stringify({
        send_email: "critical",
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      defaultToolNames: JSON.stringify(["draft_response", "send_email", "search_knowledge", "summarize"]),
      version: 1,
      isActive: true,
    },
  });
  const sdrTemplate = await db.employeeTemplate.create({
    data: {
      name: "Sales Development Rep",
      role: "sales_development_representative",
      description: "Researches prospects and drafts personalized outreach emails.",
      defaultJobDescription:
        "Research prospects from LinkedIn and company websites. Draft personalized outreach emails. Follow up on replies and schedule demos. Maintain CRM hygiene.",
      defaultApprovalRules: JSON.stringify({
        send_email: "critical",
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      defaultToolNames: JSON.stringify(["draft_response", "send_email", "search_knowledge", "summarize"]),
      version: 1,
      isActive: true,
    },
  });
  const raTemplate = await db.employeeTemplate.create({
    data: {
      name: "Research Analyst",
      role: "research_analyst",
      description: "Researches market trends and produces briefings for leadership.",
      defaultJobDescription:
        "Research market trends, competitor moves, and industry reports. Summarize findings into briefings for the leadership team. Maintain a research knowledge base.",
      defaultApprovalRules: JSON.stringify({
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      defaultToolNames: JSON.stringify(["search_knowledge", "summarize", "draft_response"]),
      version: 1,
      isActive: true,
    },
  });
  const feTemplate = await db.employeeTemplate.create({
    data: {
      name: "Finance Employee",
      role: "finance_employee",
      description: "Manages accounts receivable, collections, and customer follow-ups.",
      defaultJobDescription:
        "Review overdue invoices, assess customer risk, calculate aging, and generate collection reminders. Always require human approval before sending any customer communication. Update collection cases and follow-up history for every action.",
      defaultApprovalRules: JSON.stringify({
        generate_reminder: "non_critical",
        send_reminder: "critical",
        update_collection_case: "non_critical",
        search_knowledge: "non_critical",
      }),
      defaultToolNames: JSON.stringify(["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"]),
      version: 1,
      isActive: true,
    },
  });
  console.log("  ✓ Created 4 employee templates");

  // ─── Tools ────────────────────────────────────────────────────────────────
  const tools = await Promise.all(
    [
      { name: "draft_response", displayName: "Draft Response", description: "Drafts a response for review without sending.", defaultCriticality: "non_critical" },
      { name: "send_email", displayName: "Send Email", description: "Sends an email on behalf of the employee. Always critical.", defaultCriticality: "critical" },
      { name: "search_knowledge", displayName: "Search Knowledge", description: "Searches uploaded knowledge documents for grounding.", defaultCriticality: "non_critical" },
      { name: "summarize", displayName: "Summarize", description: "Summarizes long content into a brief.", defaultCriticality: "non_critical" },
      // Finance tools
      { name: "generate_reminder", displayName: "Generate Reminder", description: "Generates a collection reminder email for an overdue invoice.", defaultCriticality: "non_critical" },
      { name: "send_reminder", displayName: "Send Reminder", description: "Sends a collection reminder to a customer. Always requires human approval.", defaultCriticality: "critical" },
      { name: "update_collection_case", displayName: "Update Collection Case", description: "Creates or updates a collection case and records follow-up history.", defaultCriticality: "non_critical" },
    ].map((t) => db.tool.create({ data: { ...t, inputSchema: "{}", outputSchema: "{}", version: 1, isActive: true } }))
  );
  console.log("  ✓ Created 7 tools (4 generic + 3 finance)");

  // ─── Employees ────────────────────────────────────────────────────────────
  const saanvi = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Saanvi",
      role: "customer_support_agent",
      templateId: csaTemplate.id,
      status: "active",
      state: "idle",
      jobDescription:
        "Draft replies to customer queries about orders, returns, and product information. Route complex billing issues to the finance team. Always ground responses in the returns policy and FAQ documents.",
      boundaries: JSON.stringify([
        "Never process refunds directly — route to finance",
        "Maximum 50 emails per day",
        "Never share internal pricing with customers",
        "Always cite the source document for policy answers",
      ]),
      approvalRules: JSON.stringify({
        send_email: "critical",
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      tools: JSON.stringify(["draft_response", "send_email", "search_knowledge", "summarize"]),
      tokenCap: 5000000,
      createdBy: rohit.id,
      activatedAt: new Date(),
    },
  });

  const arjun = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Arjun",
      role: "sales_development_representative",
      templateId: sdrTemplate.id,
      status: "active",
      state: "idle",
      jobDescription:
        "Research prospects from LinkedIn and company websites. Draft personalized outreach emails. Follow up on replies and schedule demos. Maintain CRM hygiene.",
      boundaries: JSON.stringify([
        "Never make pricing commitments",
        "Maximum 30 outreach emails per day",
        "Always verify prospect title before outreach",
        "Never contact competitors' employees",
      ]),
      approvalRules: JSON.stringify({
        send_email: "critical",
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      tools: JSON.stringify(["draft_response", "send_email", "search_knowledge", "summarize"]),
      tokenCap: 5000000,
      createdBy: rohit.id,
      activatedAt: new Date(),
    },
  });

  const meera = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Meera",
      role: "research_analyst",
      templateId: raTemplate.id,
      status: "active",
      state: "idle",
      jobDescription:
        "Research market trends, competitor moves, and industry reports. Summarize findings into briefings for the leadership team. Maintain a research knowledge base.",
      boundaries: JSON.stringify([
        "Only use publicly available sources",
        "Never access paid databases without approval",
        "Cite all sources",
        "Maximum 5 research briefings per week",
      ]),
      approvalRules: JSON.stringify({
        draft_response: "non_critical",
        search_knowledge: "non_critical",
        summarize: "non_critical",
      }),
      tools: JSON.stringify(["search_knowledge", "summarize", "draft_response"]),
      tokenCap: 3000000,
      createdBy: rohit.id,
      activatedAt: new Date(),
    },
  });

  // Finance Employee — processes overdue invoices and collections
  const kavya = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Kavya",
      role: "finance_employee",
      templateId: feTemplate.id,
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
      tools: JSON.stringify(["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"]),
      tokenCap: 5000000,
      createdBy: rohit.id,
      activatedAt: new Date(),
    },
  });
  console.log("  ✓ Created 4 active employees (3 generic + 1 finance)");

  // ─── Tool permissions ────────────────────────────────────────────────────
  for (const emp of [saanvi, arjun, meera, kavya]) {
    const toolNames: string[] = JSON.parse(emp.tools);
    for (const toolName of toolNames) {
      const tool = tools.find((t) => t.name === toolName);
      if (tool) {
        await db.employeeToolPermission.create({
          data: { employeeId: emp.id, toolId: tool.id, grantedBy: rohit.id },
        });
      }
    }
  }

  // ─── Finance Domain: Customers, Invoices, Payments ───────────────────────
  console.log("  ✓ Creating finance domain data...");

  // Customers
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
  console.log(`  ✓ Created ${customerRecords.length} customers`);

  // Invoices — realistic AR data with various aging scenarios
  // All amounts in paise (1 rupee = 100 paise)
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const invoiceDefs = [
    // Sundar Electronics — current (not overdue)
    { customerIdx: 0, invoiceNumber: "INV-2025-001", issueDays: 5, dueDays: 25, subtotal: 15000000, tax: 2700000 },
    // Nair Textiles — 1-30 days overdue, no reminders
    { customerIdx: 1, invoiceNumber: "INV-2025-002", issueDays: 45, dueDays: 15, subtotal: 8500000, tax: 1530000 },
    // BlueDart Logistics — 31-60 days overdue, 1 reminder sent
    { customerIdx: 2, invoiceNumber: "INV-2025-003", issueDays: 75, dueDays: 45, subtotal: 12000000, tax: 2160000 },
    // FastFreight India — 61-90 days overdue, 2 reminders sent
    { customerIdx: 3, invoiceNumber: "INV-2025-004", issueDays: 105, dueDays: 90, subtotal: 4500000, tax: 810000 },
    // Acme Pharma — 90+ days overdue, 3 reminders sent (write-off candidate)
    { customerIdx: 4, invoiceNumber: "INV-2024-098", issueDays: 125, dueDays: 65, subtotal: 22000000, tax: 3960000 },
    // BlueDart Logistics — partially paid
    { customerIdx: 2, invoiceNumber: "INV-2025-005", issueDays: 50, dueDays: 20, subtotal: 6700000, tax: 1206000 },
    // Sundar Electronics — another current invoice
    { customerIdx: 0, invoiceNumber: "INV-2025-006", issueDays: 2, dueDays: 28, subtotal: 9500000, tax: 1710000 },
    // Nair Textiles — 1-30 days overdue, 1 reminder sent
    { customerIdx: 1, invoiceNumber: "INV-2025-007", issueDays: 40, dueDays: 5, subtotal: 3200000, tax: 576000 },
  ];

  const invoiceRecords = [];
  for (const def of invoiceDefs) {
    const customer = customerRecords[def.customerIdx];
    const total = def.subtotal + def.tax;
    const issueDate = daysAgo(def.issueDays);
    const dueDate = daysAgo(def.dueDays);

    // Determine status based on due date
    const isOverdue = dueDate < now;
    const status = isOverdue ? "overdue" : "unpaid";

    const invoice = await db.invoice.create({
      data: {
        workspaceId: workspace.id,
        customerId: customer.id,
        invoiceNumber: def.invoiceNumber,
        issueDate,
        dueDate,
        subtotal: def.subtotal,
        tax: def.tax,
        total,
        amountPaid: 0,
        outstanding: total,
        status,
        paymentTerms: customer.paymentTerms,
        createdBy: rohit.id,
      },
    });

    invoiceRecords.push({ ...invoice, customer, def });
  }

  // Add a partial payment for INV-2025-005 (BlueDart)
  const partialInv = invoiceRecords.find((i) => i.invoiceNumber === "INV-2025-005");
  if (partialInv) {
    const partialPayment = 3000000; // ₹30,000
    await db.payment.create({
      data: {
        workspaceId: workspace.id,
        invoiceId: partialInv.id,
        customerId: partialInv.customerId,
        amount: partialPayment,
        paymentDate: daysAgo(15),
        method: "bank_transfer",
        reference: "NEFT-HDFC-984732",
        status: "completed",
        recordedBy: rohit.id,
      },
    });
    await db.invoice.update({
      where: { id: partialInv.id },
      data: {
        amountPaid: partialPayment,
        outstanding: partialInv.total - partialPayment,
        status: "partially_paid",
      },
    });
  }

  // Add reminders for invoices that should have them
  const reminderInvoices = [
    { invoiceNumber: "INV-2025-003", daysAgo: 30, type: "first" },
    { invoiceNumber: "INV-2025-004", daysAgo: 60, type: "first" },
    { invoiceNumber: "INV-2025-004", daysAgo: 35, type: "follow_up" },
    { invoiceNumber: "INV-2024-098", daysAgo: 90, type: "first" },
    { invoiceNumber: "INV-2024-098", daysAgo: 65, type: "follow_up" },
    { invoiceNumber: "INV-2024-098", daysAgo: 40, type: "escalation" },
    { invoiceNumber: "INV-2025-007", daysAgo: 10, type: "first" },
  ];

  for (const r of reminderInvoices) {
    const inv = invoiceRecords.find((i) => i.invoiceNumber === r.invoiceNumber);
    if (!inv) continue;
    const subject = r.type === "first" ? `Payment Reminder: Invoice ${r.invoiceNumber}` : r.type === "follow_up" ? `URGENT: Follow-up on Invoice ${r.invoiceNumber}` : `Final Notice: Invoice ${r.invoiceNumber}`;
    await db.reminder.create({
      data: {
        workspaceId: workspace.id,
        invoiceId: inv.id,
        customerId: inv.customerId,
        reminderType: "email",
        subject,
        body: `Dear ${inv.customer.name},\n\nThis is a ${r.type === "first" ? "friendly reminder" : r.type === "follow_up" ? "urgent follow-up" : "final notice"} regarding Invoice ${r.invoiceNumber}.`,
        status: "sent",
        sentAt: daysAgo(r.daysAgo),
      },
    });
  }

  console.log(`  ✓ Created ${invoiceRecords.length} invoices, 1 partial payment, ${reminderInvoices.length} reminders`);
  console.log("  ✓ Finance domain data ready (customers, invoices, payments, reminders)");

  // ─── Knowledge documents ──────────────────────────────────────────────────
  const docs = [
    { filename: "returns-policy.pdf", contentType: "application/pdf", sizeBytes: 184320, status: "ready", chunkCount: 24, employeeId: saanvi.id },
    { filename: "product-catalog-2025.pdf", contentType: "application/pdf", sizeBytes: 2456789, status: "ready", chunkCount: 156, employeeId: saanvi.id },
    { filename: "faq-knowledge-base.md", contentType: "text/markdown", sizeBytes: 45200, status: "ready", chunkCount: 18, employeeId: saanvi.id },
    { filename: "competitor-analysis-q4.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 892400, status: "ready", chunkCount: 67, employeeId: meera.id },
    { filename: "sales-playbook-2025.pdf", contentType: "application/pdf", sizeBytes: 1204500, status: "ready", chunkCount: 89, employeeId: arjun.id },
  ];
  for (const d of docs) {
    await db.knowledgeDocument.create({
      data: {
        workspaceId: workspace.id,
        employeeId: d.employeeId,
        filename: d.filename,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        storageKey: `ws/${workspace.id}/doc/${d.filename}`,
        status: d.status,
        chunkCount: d.chunkCount,
        uploadedBy: rohit.id,
      },
    });
  }
  console.log(`  ✓ Created ${docs.length} knowledge documents`);

  // ─── Departments ──────────────────────────────────────────────────────────
  for (const name of ["Customer Support", "Sales", "Research", "Finance"]) {
    const existing = await db.department.findFirst({ where: { workspaceId: workspace.id, name } });
    if (!existing) {
      await db.department.create({
        data: {
          workspaceId: workspace.id,
          name,
          description: name === "Customer Support" ? "Tier 1 & 2 customer query resolution" : name === "Sales" ? "Outbound prospecting and account management" : name === "Research" ? "Market intelligence and competitive analysis" : "Billing, refunds, and financial operations",
        },
      });
    }
  }
  console.log("  ✓ Created 4 departments");

  // ─── Capabilities ────────────────────────────────────────────────────────
  const { seedCapabilities, grantFinanceCapabilities, FINANCE_CAPABILITIES } = await import("../src/lib/capabilities/engine");
  await seedCapabilities();
  console.log(`  ✓ Seeded ${FINANCE_CAPABILITIES.length + 3} capabilities (finance + restricted)`);

  // Grant finance capabilities to Kavya (the Finance Employee)
  await grantFinanceCapabilities(kavya.id, rohit.id);
  console.log(`  ✓ Granted ${FINANCE_CAPABILITIES.length} capabilities to Kavya (Finance Employee)`);

  console.log("\n✅ Clean V1 seed complete!");
  console.log("   Login: rohit@acmetrading.in / demo-password");
  console.log("   Workspace: acme-trading");
  console.log("   No tasks, steps, approvals, or audit logs seeded.");
  console.log("   Create a task in the UI and the worker will execute it live.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
