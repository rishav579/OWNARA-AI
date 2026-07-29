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
  console.log("  ✓ Created 3 employee templates");

  // ─── Tools ────────────────────────────────────────────────────────────────
  const tools = await Promise.all(
    [
      { name: "draft_response", displayName: "Draft Response", description: "Drafts a response for review without sending.", defaultCriticality: "non_critical" },
      { name: "send_email", displayName: "Send Email", description: "Sends an email on behalf of the employee. Always critical.", defaultCriticality: "critical" },
      { name: "search_knowledge", displayName: "Search Knowledge", description: "Searches uploaded knowledge documents for grounding.", defaultCriticality: "non_critical" },
      { name: "summarize", displayName: "Summarize", description: "Summarizes long content into a brief.", defaultCriticality: "non_critical" },
    ].map((t) => db.tool.create({ data: { ...t, inputSchema: "{}", outputSchema: "{}", version: 1, isActive: true } }))
  );
  console.log("  ✓ Created 4 tools");

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
  console.log("  ✓ Created 3 active employees");

  // ─── Tool permissions ────────────────────────────────────────────────────
  for (const emp of [saanvi, arjun, meera]) {
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
