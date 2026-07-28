// BIHARI AI — Database seed script
// Run with: bun run scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BIHARI AI database...");

  // Clean slate
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.llmUsage.deleteMany();
  await db.knowledgeDocument.deleteMany();
  await db.employeeToolPermission.deleteMany();
  await db.taskStep.deleteMany();
  await db.approval.deleteMany();
  await db.task.deleteMany();
  await db.employee.deleteMany();
  await db.tool.deleteMany();
  await db.employeeTemplate.deleteMany();
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
      emailVerifiedAt: new Date("2025-01-12T10:04:00Z"),
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
      joinedAt: new Date("2025-01-12T09:55:00Z"),
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
      state: "waiting_approval",
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
      tokenUsage: 1245000,
      tokenCap: 5000000,
      pendingApprovals: 2,
      taskCount: 48,
      completedTasks: 44,
      createdBy: rohit.id,
      activatedAt: new Date("2025-01-12T10:15:00Z"),
    },
  });

  const arjun = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Arjun",
      role: "sales_development_representative",
      templateId: sdrTemplate.id,
      status: "active",
      state: "executing",
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
      tokenUsage: 892000,
      tokenCap: 5000000,
      pendingApprovals: 0,
      taskCount: 32,
      completedTasks: 28,
      createdBy: rohit.id,
      activatedAt: new Date("2025-01-14T09:30:00Z"),
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
      tokenUsage: 456000,
      tokenCap: 3000000,
      pendingApprovals: 0,
      taskCount: 19,
      completedTasks: 19,
      createdBy: rohit.id,
      activatedAt: new Date("2025-01-16T14:30:00Z"),
    },
  });

  const vikram = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Vikram",
      role: "customer_support_agent",
      templateId: csaTemplate.id,
      status: "paused",
      state: "paused",
      jobDescription:
        "Handle Tier 2 customer escalations. Draft resolution emails and coordinate with the logistics team for shipping issues.",
      boundaries: JSON.stringify([
        "Escalate legal threats immediately",
        "Maximum 30 emails per day",
        "Never authorize replacements over ₹5,000",
      ]),
      approvalRules: JSON.stringify({
        send_email: "critical",
        draft_response: "non_critical",
        search_knowledge: "non_critical",
      }),
      tools: JSON.stringify(["draft_response", "send_email", "search_knowledge"]),
      tokenUsage: 2103000,
      tokenCap: 5000000,
      pendingApprovals: 0,
      taskCount: 67,
      completedTasks: 65,
      createdBy: rohit.id,
      activatedAt: new Date("2025-01-10T08:30:00Z"),
    },
  });

  const priya = await db.employee.create({
    data: {
      workspaceId: workspace.id,
      name: "Priya",
      role: "sales_development_representative",
      templateId: sdrTemplate.id,
      status: "retired",
      state: "idle",
      jobDescription: "Outbound SDR for the North India region. Retired after Q4 campaign completion.",
      boundaries: JSON.stringify(["Retired — read-only configuration"]),
      approvalRules: JSON.stringify({ send_email: "critical", draft_response: "non_critical" }),
      tools: JSON.stringify(["draft_response", "send_email", "search_knowledge", "summarize"]),
      tokenUsage: 3890000,
      tokenCap: 5000000,
      pendingApprovals: 0,
      taskCount: 124,
      completedTasks: 120,
      createdBy: rohit.id,
      activatedAt: new Date("2024-12-01T10:30:00Z"),
      retiredAt: new Date("2025-01-05T10:00:00Z"),
    },
  });
  console.log("  ✓ Created 5 employees");

  // ─── Tool permissions ────────────────────────────────────────────────────
  for (const emp of [saanvi, arjun, meera, vikram, priya]) {
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

  // ─── Tasks + Steps ────────────────────────────────────────────────────────
  const task1 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: saanvi.id,
      assignedBy: rohit.id,
      title: "Draft replies to today's pending customer queries",
      description: "Process the support inbox and draft replies for 12 pending customer queries. Flag any refund requests above ₹2,000 for approval before sending.",
      status: "waiting_approval",
      priority: "high",
      stepCount: 7,
      stepCap: 20,
      tokenUsage: 8420,
      tokenCap: 100000,
      startedAt: new Date("2025-01-28T10:20:00Z"),
    },
  });
  const steps = [
    { stepType: "plan", reasoning: "I will search the knowledge base for the returns policy, then process each query in the inbox, drafting responses grounded in the policy. Emails will be flagged for approval before sending.", status: "completed", tokens: 420, durationMs: 3100, input: "{}", output: "{}" },
    { stepType: "tool_call", reasoning: "Searched knowledge base for 'returns policy' and retrieved 3 relevant chunks from returns-policy.pdf.", status: "completed", tokens: 380, durationMs: 1200, input: JSON.stringify({ tool: "search_knowledge", query: "returns policy" }), output: JSON.stringify({ result: "3 chunks retrieved from returns-policy.pdf" }) },
    { stepType: "reasoning", reasoning: "Query from Priya about order #2231: she wants to know the status. Order shipped yesterday via Delhivery, tracking DLV-8847. I'll draft a response with the tracking link.", status: "completed", tokens: 890, durationMs: 2400, input: "{}", output: "{}" },
    { stepType: "tool_call", reasoning: "Drafted a response to Priya confirming shipment with tracking details.", status: "completed", tokens: 640, durationMs: 1800, input: JSON.stringify({ tool: "draft_response" }), output: JSON.stringify({ draft: "Hi Priya, your order #2231 shipped on Jan 27 via Delhivery. Track it at delhivery.com/track/DLV-8847..." }) },
    { stepType: "reasoning", reasoning: "Query from Rajesh about a refund for a damaged product (₹3,499). This exceeds my ₹2,000 authorization limit. I'll flag the refund email for human approval.", status: "completed", tokens: 720, durationMs: 2100, input: "{}", output: "{}" },
    { stepType: "approval_gate", reasoning: "Approval required to send refund confirmation email to Rajesh for ₹3,499. The email proposes a full refund and a 15% discount on the next order.", status: "pending", tokens: 510, durationMs: 0, input: "{}", output: "{}" },
    { stepType: "reasoning", reasoning: "5 remaining queries are being processed. Awaiting approval on the refund before continuing.", status: "pending", tokens: 0, durationMs: 0, input: "{}", output: "{}" },
  ];
  for (let i = 0; i < steps.length; i++) {
    await db.taskStep.create({
      data: {
        taskId: task1.id,
        stepNumber: i + 1,
        ...steps[i],
        startedAt: new Date(Date.parse("2025-01-28T10:20:00Z") + i * 30000),
        completedAt: steps[i].status === "completed" ? new Date(Date.parse("2025-01-28T10:20:00Z") + i * 30000 + steps[i].durationMs) : null,
      },
    });
  }

  const task2 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: arjun.id,
      assignedBy: rohit.id,
      title: "Research 15 prospects in the logistics sector",
      description: "Identify 15 mid-size logistics companies in South India. Research their current tech stack and draft personalized outreach emails for each.",
      status: "executing",
      priority: "medium",
      stepCount: 9,
      stepCap: 25,
      tokenUsage: 12300,
      tokenCap: 150000,
      startedAt: new Date("2025-01-28T09:15:00Z"),
    },
  });
  const task3 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: meera.id,
      assignedBy: rohit.id,
      title: "Summarize Q4 competitor pricing report",
      description: "Research and summarize the Q4 pricing changes across 5 competitors. Deliver a 2-page briefing for the leadership review on Friday.",
      status: "completed",
      priority: "medium",
      stepCount: 6,
      stepCap: 15,
      tokenUsage: 6800,
      tokenCap: 80000,
      startedAt: new Date("2025-01-27T14:00:00Z"),
      completedAt: new Date("2025-01-27T16:45:00Z"),
    },
  });
  const task4 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: arjun.id,
      assignedBy: rohit.id,
      title: "Follow up on 8 warm leads from last week",
      description: "Send follow-up emails to 8 prospects who opened the initial outreach but did not reply.",
      status: "waiting_approval",
      priority: "high",
      stepCount: 4,
      stepCap: 20,
      tokenUsage: 5400,
      tokenCap: 100000,
      startedAt: new Date("2025-01-28T11:00:00Z"),
    },
  });
  const task5 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: saanvi.id,
      assignedBy: rohit.id,
      title: "Process weekend customer escalations",
      description: "Review and respond to 5 escalation tickets that came in over the weekend.",
      status: "completed",
      priority: "high",
      stepCount: 12,
      stepCap: 20,
      tokenUsage: 14200,
      tokenCap: 100000,
      startedAt: new Date("2025-01-27T09:00:00Z"),
      completedAt: new Date("2025-01-27T11:30:00Z"),
    },
  });
  const task6 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: meera.id,
      assignedBy: rohit.id,
      title: "Compile monthly research digest",
      description: "Create a monthly digest of industry news, competitor moves, and market signals.",
      status: "failed",
      priority: "low",
      stepCount: 3,
      stepCap: 15,
      tokenUsage: 3200,
      tokenCap: 80000,
      startedAt: new Date("2025-01-26T10:00:00Z"),
    },
  });
  const task7 = await db.task.create({
    data: {
      workspaceId: workspace.id,
      employeeId: vikram.id,
      assignedBy: rohit.id,
      title: "Draft onboarding welcome sequence for new SaaS clients",
      description: "Create a 3-email welcome sequence for clients who sign up for the enterprise plan.",
      status: "stopped",
      priority: "medium",
      stepCount: 2,
      stepCap: 15,
      tokenUsage: 1800,
      tokenCap: 80000,
      startedAt: new Date("2025-01-25T13:00:00Z"),
    },
  });
  console.log("  ✓ Created 7 tasks with steps");

  // ─── Approvals ────────────────────────────────────────────────────────────
  const approval1 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task1.id,
      employeeId: saanvi.id,
      tool: "send_email",
      toolDisplayName: "Send Email",
      proposedAction: JSON.stringify({
        to: "rajesh.kumar@gmail.com",
        subject: "Re: Refund request for order #2198 — damaged product",
        body: "Dear Rajesh, thank you for reaching out about the damaged product in order #2198. I sincerely apologize for the inconvenience. I've processed a full refund of ₹3,499 to your original payment method, which should reflect in 5-7 business days. Additionally, I've added a 15% discount code (WELCOME15) to your account for your next purchase. We take product quality seriously and have flagged this with our logistics team. Please let me know if there's anything else I can help with. Best regards, Saanvi (on behalf of Acme Trading)",
      }),
      status: "pending",
      criticality: "critical",
      timeoutAt: new Date("2025-01-28T22:00:00Z"),
    },
  });
  const approval2 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task4.id,
      employeeId: arjun.id,
      tool: "send_email",
      toolDisplayName: "Send Email",
      proposedAction: JSON.stringify({
        to: "anita@bluedart-logistics.in",
        subject: "Re: Your interest in Acme's logistics automation platform",
        body: "Hi Anita, I noticed you opened our previous email about Acme's automation platform. Many logistics teams in South India are using our tool to reduce manual dispatch errors by up to 40%. Would you have 20 minutes this Thursday for a quick demo? I can show you how BlueDart-sized operations integrate our API in under a week. Best, Arjun",
      }),
      status: "pending",
      criticality: "critical",
      timeoutAt: new Date("2025-01-29T11:00:00Z"),
    },
  });
  const approval3 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task5.id,
      employeeId: saanvi.id,
      tool: "send_email",
      toolDisplayName: "Send Email",
      proposedAction: JSON.stringify({
        to: "deepak@sundar-electronics.in",
        subject: "Re: Escalation — order delayed by 12 days",
        body: "Dear Mr. Sundar, I deeply apologize for the unacceptable delay on order #3321. I've personally tracked the shipment and confirmed it will arrive by tomorrow 6 PM. As a gesture of goodwill, I've issued a ₹500 store credit. We've also filed a formal complaint with our courier partner.",
      }),
      status: "approved",
      criticality: "critical",
      timeoutAt: new Date("2025-01-27T22:00:00Z"),
      decidedBy: rohit.id,
      decidedAt: new Date("2025-01-27T10:35:00Z"),
      decision: "approved",
      reason: "Good response — personal and empathetic.",
    },
  });
  const approval4 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task2.id,
      employeeId: arjun.id,
      tool: "send_email",
      toolDisplayName: "Send Email",
      proposedAction: JSON.stringify({
        to: "cto@fastfreight.in",
        subject: "Acme + FastFreight: reducing dispatch errors by 40%",
        body: "Hi, I saw FastFreight's recent expansion into Tamil Nadu. Acme helps logistics companies like yours automate dispatch routing and reduce manual errors...",
      }),
      status: "rejected",
      criticality: "critical",
      timeoutAt: new Date("2025-01-28T21:00:00Z"),
      decidedBy: rohit.id,
      decidedAt: new Date("2025-01-28T09:50:00Z"),
      decision: "rejected",
      reason: "Tone is too generic. Personalize with FastFreight's specific expansion news.",
    },
  });
  const approval5 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task5.id,
      employeeId: saanvi.id,
      tool: "send_email",
      toolDisplayName: "Send Email",
      proposedAction: JSON.stringify({
        to: "lakshmi@nair-textiles.in",
        subject: "Re: Wrong item delivered — order #3401",
        body: "Dear Lakshmi, I apologize for the mix-up. A replacement for the correct item has been dispatched and will arrive in 2 days. Please keep the wrong item at no charge.",
      }),
      status: "modified",
      criticality: "critical",
      timeoutAt: new Date("2025-01-27T23:00:00Z"),
      decidedBy: rohit.id,
      decidedAt: new Date("2025-01-27T11:10:00Z"),
      decision: "modified",
      reason: "Added tracking link and extended the timeline to 3 days to be safe.",
      modifiedAction: JSON.stringify({
        to: "lakshmi@nair-textiles.in",
        subject: "Re: Wrong item delivered — order #3401",
        body: "Dear Lakshmi, I apologize for the mix-up. A replacement has been dispatched (tracking DLV-9921) and will arrive in 3 days. Please keep the wrong item at no charge.",
      }),
    },
  });
  const approval6 = await db.approval.create({
    data: {
      workspaceId: workspace.id,
      taskId: task3.id,
      employeeId: meera.id,
      tool: "draft_response",
      toolDisplayName: "Draft Response",
      proposedAction: JSON.stringify({
        output: "Q4 Competitor Pricing Briefing: Competitor A raised prices 8%, Competitor B introduced a freemium tier...",
      }),
      status: "expired",
      criticality: "non_critical",
      timeoutAt: new Date("2025-01-27T04:00:00Z"),
    },
  });
  console.log("  ✓ Created 6 approvals");

  // ─── Knowledge documents ──────────────────────────────────────────────────
  const docs = [
    { filename: "returns-policy.pdf", contentType: "application/pdf", sizeBytes: 184320, status: "ready", chunkCount: 24, employeeId: saanvi.id },
    { filename: "product-catalog-2025.pdf", contentType: "application/pdf", sizeBytes: 2456789, status: "ready", chunkCount: 156, employeeId: saanvi.id },
    { filename: "faq-knowledge-base.md", contentType: "text/markdown", sizeBytes: 45200, status: "ready", chunkCount: 18, employeeId: saanvi.id },
    { filename: "competitor-analysis-q4.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 892400, status: "ready", chunkCount: 67, employeeId: meera.id },
    { filename: "sales-playbook-2025.pdf", contentType: "application/pdf", sizeBytes: 1204500, status: "ready", chunkCount: 89, employeeId: arjun.id },
    { filename: "shipping-rates-matrix.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 67800, status: "processing", chunkCount: 0, employeeId: saanvi.id },
    { filename: "industry-report-logistics.txt", contentType: "text/plain", sizeBytes: 234000, status: "failed", chunkCount: 0, employeeId: meera.id },
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
  console.log("  ✓ Created 7 knowledge documents");

  // ─── Audit logs (hash-chained) ────────────────────────────────────────────
  const crypto = await import("crypto");
  const auditEntries = [
    { entryType: "employee_resumed", actorType: "user", actorId: rohit.id, actorName: "Rohit Sharma", targetType: "employee", targetId: saanvi.id, payload: { employee: "Saanvi", prior_state: "paused" }, createdAt: new Date("2025-01-28T10:19:00Z") },
    { entryType: "task_started", actorType: "user", actorId: rohit.id, actorName: "Rohit Sharma", targetType: "task", targetId: task1.id, payload: { title: "Draft replies to today's pending queries", employee: "Saanvi", config_version: "3" }, createdAt: new Date("2025-01-28T10:20:00Z") },
    { entryType: "step_executed", actorType: "employee", actorId: saanvi.id, actorName: "Saanvi", targetType: "task_step", targetId: "step3", payload: { step: "3", type: "reasoning", tokens: "890" }, createdAt: new Date("2025-01-28T10:22:45Z") },
    { entryType: "llm_call", actorType: "system", actorId: null, actorName: "LLM Gateway", targetType: "task_step", targetId: "step4", payload: { model: "gpt-4o-mini", tokens: "640", cost_cents: "1", latency_ms: "1800" }, createdAt: new Date("2025-01-28T10:23:02Z") },
    { entryType: "tool_executed", actorType: "employee", actorId: saanvi.id, actorName: "Saanvi", targetType: "task_step", targetId: "step4", payload: { tool: "draft_response", status: "completed" }, createdAt: new Date("2025-01-28T10:23:04Z") },
    { entryType: "step_executed", actorType: "employee", actorId: saanvi.id, actorName: "Saanvi", targetType: "task_step", targetId: "step5", payload: { step: "5", type: "reasoning", tokens: "720" }, createdAt: new Date("2025-01-28T10:23:30Z") },
    { entryType: "approval_requested", actorType: "employee", actorId: saanvi.id, actorName: "Saanvi", targetType: "approval", targetId: approval1.id, payload: { tool: "send_email", task: "Draft replies to today's pending queries", criticality: "critical" }, createdAt: new Date("2025-01-28T10:23:58Z") },
    { entryType: "approval_decided", actorType: "user", actorId: rohit.id, actorName: "Rohit Sharma", targetType: "approval", targetId: approval1.id, payload: { decision: "pending", tool: "send_email", employee: "Saanvi" }, createdAt: new Date("2025-01-28T10:24:00Z") },
  ];
  let prevHash: string | null = null;
  for (let i = 0; i < auditEntries.length; i++) {
    const entry = auditEntries[i];
    const seq = i + 135;
    const canonical = JSON.stringify({
      workspaceId: workspace.id,
      sequenceNumber: seq,
      entryType: entry.entryType,
      actorType: entry.actorType,
      actorName: entry.actorName,
      targetType: entry.targetType,
      targetId: entry.targetId,
      payload: entry.payload,
      createdAt: entry.createdAt.toISOString(),
    });
    const entryHash = crypto
      .createHash("sha256")
      .update((prevHash || "") + canonical)
      .digest("hex");
    await db.auditLog.create({
      data: {
        workspaceId: workspace.id,
        sequenceNumber: seq,
        entryType: entry.entryType,
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        targetType: entry.targetType,
        targetId: entry.targetId,
        payload: JSON.stringify(entry.payload),
        previousHash: prevHash,
        entryHash,
        createdAt: entry.createdAt,
      },
    });
    prevHash = entryHash;
  }
  console.log("  ✓ Created 8 audit log entries (hash-chained)");

  // ─── Notifications ────────────────────────────────────────────────────────
  const notifs = [
    { type: "approval_pending", title: "Saanvi needs your approval", body: "Send email to rajesh.kumar@gmail.com — refund of ₹3,499", referenceType: "approval", referenceId: approval1.id, read: false, createdAt: new Date("2025-01-28T10:24:00Z") },
    { type: "approval_pending", title: "Arjun needs your approval", body: "Send follow-up email to anita@bluedart-logistics.in", referenceType: "approval", referenceId: approval2.id, read: false, createdAt: new Date("2025-01-28T11:12:00Z") },
    { type: "task_completed", title: "Meera completed a task", body: "Q4 competitor pricing report — 2-page briefing delivered", referenceType: "task", referenceId: task3.id, read: false, createdAt: new Date("2025-01-27T16:45:00Z") },
    { type: "task_failed", title: "Meera's task failed", body: "Monthly research digest failed — token cap exceeded", referenceType: "task", referenceId: task6.id, read: true, createdAt: new Date("2025-01-26T14:30:00Z") },
    { type: "employee_paused", title: "Vikram was paused", body: "You paused Vikram (Customer Support Agent)", referenceType: "employee", referenceId: vikram.id, read: true, createdAt: new Date("2025-01-25T16:00:00Z") },
  ];
  for (const n of notifs) {
    await db.notification.create({
      data: {
        workspaceId: workspace.id,
        userId: rohit.id,
        type: n.type,
        title: n.title,
        body: n.body,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        channel: "in_app",
        status: n.read ? "read" : "delivered",
        readAt: n.read ? n.createdAt : null,
        createdAt: n.createdAt,
      },
    });
  }
  console.log("  ✓ Created 5 notifications");

  // ─── LLM usage records ────────────────────────────────────────────────────
  const dailyTokens = [32000, 48000, 21000, 56000, 14000, 8000, 39000, 67000, 52000, 31000, 22000, 16000, 78000, 42000];
  for (let i = 0; i < dailyTokens.length; i++) {
    const tokens = dailyTokens[i];
    await db.llmUsage.create({
      data: {
        workspaceId: workspace.id,
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: Math.floor(tokens * 0.7),
        completionTokens: Math.floor(tokens * 0.3),
        totalTokens: tokens,
        costCents: Math.floor(tokens / 1000),
        latencyMs: 2000 + Math.floor(Math.random() * 2000),
        status: "success",
        createdAt: new Date(Date.parse("2025-01-15T00:00:00Z") + i * 86400000),
      },
    });
  }
  console.log("  ✓ Created LLM usage records");

  console.log("\n✅ Seed complete!");
  console.log(`   Login: rohit@acmetrading.in / demo-password`);
  console.log(`   Workspace: ${workspace.slug}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
