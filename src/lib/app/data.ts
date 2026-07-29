// BIHARI AI — Application sample data + types
// Realistic data for an Indian B2B AI Employee SaaS platform.

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmployeeStatus = "draft" | "active" | "paused" | "retired";
export type EmployeeState =
  | "idle"
  | "assigned"
  | "planning"
  | "executing"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "paused"
  | "stopped";

export type TaskStatus =
  | "queued"
  | "assigned"
  | "planning"
  | "executing"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "paused"
  | "stopped";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "modified" | "expired";
export type ApprovalDecision = "approved" | "rejected" | "modified";

export type DocumentStatus = "processing" | "ready" | "failed" | "removed";

export type RoleKey = "customer_support_agent" | "sales_development_representative" | "research_analyst";

export interface Employee {
  id: string;
  name: string;
  role: RoleKey;
  roleName: string;
  templateId: string;
  status: EmployeeStatus;
  state: EmployeeState;
  avatarColor: string;
  createdAt: string;
  activatedAt: string | null;
  taskCount: number;
  completedTasks: number;
  tokenUsage: number;
  tokenCap: number;
  tools: string[];
  pendingApprovals: number;
  jobDescription: string;
  boundaries: string[];
  approvalRules: Record<string, "critical" | "non_critical">;
}

export interface TaskStep {
  stepNumber: number;
  stepType: "plan" | "reasoning" | "tool_call" | "approval_gate";
  reasoning: string;
  tool?: string;
  output?: string;
  status: "completed" | "running" | "pending" | "failed";
  tokens: number;
  durationMs: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  employeeId: string;
  employeeName: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  stepCount: number;
  stepCap: number;
  tokenUsage: number;
  tokenCap: number;
  assignedBy: string;
  startedAt: string;
  completedAt: string | null;
  steps?: TaskStep[];
}

export interface Approval {
  id: string;
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  tool: string;
  toolDisplayName: string;
  proposedAction: Record<string, string>;
  status: ApprovalStatus;
  createdAt: string;
  timeoutAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decision?: ApprovalDecision;
  reason?: string;
  criticality: "critical" | "non_critical";
}

export interface AuditEntry {
  id: string;
  sequenceNumber: number;
  entryType: string;
  actorType: "user" | "employee" | "system";
  actorName: string;
  targetType: string;
  targetId: string;
  payload: Record<string, string>;
  previousHash: string;
  entryHash: string;
  createdAt: string;
}

export interface KnowledgeDoc {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  employeeId: string | null;
  employeeName: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "approval_pending" | "task_completed" | "task_failed" | "employee_paused";
  title: string;
  body: string;
  referenceType: string;
  referenceId: string;
  read: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<RoleKey, string> = {
  customer_support_agent: "Customer Support Agent",
  sales_development_representative: "Sales Development Rep",
  research_analyst: "Research Analyst",
};

export const TOOL_LABELS: Record<string, string> = {
  draft_response: "Draft Response",
  send_email: "Send Email",
  search_knowledge: "Search Knowledge",
  summarize: "Summarize",
};

// ─── Sample Data ─────────────────────────────────────────────────────────────

export const CURRENT_USER = {
  id: "u_018f9a3c",
  name: "Rohit Sharma",
  email: "rohit@acmetrading.in",
  role: "owner" as const,
  workspace: "Acme Trading Pvt Ltd",
  workspaceSlug: "acme-trading",
  avatarColor: "#10b981",
};

export const EMPLOYEES: Employee[] = [
  {
    id: "e_018f9a50",
    name: "Saanvi",
    role: "customer_support_agent",
    roleName: "Customer Support Agent",
    templateId: "t_csa",
    status: "active",
    state: "waiting_approval",
    avatarColor: "#10b981",
    createdAt: "2025-01-12T10:10:00Z",
    activatedAt: "2025-01-12T10:15:00Z",
    taskCount: 48,
    completedTasks: 44,
    tokenUsage: 1245000,
    tokenCap: 5000000,
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
    pendingApprovals: 2,
    jobDescription:
      "Draft replies to customer queries about orders, returns, and product information. Route complex billing issues to the finance team. Always ground responses in the returns policy and FAQ documents.",
    boundaries: [
      "Never process refunds directly — route to finance",
      "Maximum 50 emails per day",
      "Never share internal pricing with customers",
      "Always cite the source document for policy answers",
    ],
    approvalRules: {
      send_email: "critical",
      draft_response: "non_critical",
      search_knowledge: "non_critical",
      summarize: "non_critical",
    },
  },
  {
    id: "e_018f9a51",
    name: "Arjun",
    role: "sales_development_representative",
    roleName: "Sales Development Rep",
    templateId: "t_sdr",
    status: "active",
    state: "executing",
    avatarColor: "#f59e0b",
    createdAt: "2025-01-14T09:00:00Z",
    activatedAt: "2025-01-14T09:30:00Z",
    taskCount: 32,
    completedTasks: 28,
    tokenUsage: 892000,
    tokenCap: 5000000,
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
    pendingApprovals: 0,
    jobDescription:
      "Research prospects from LinkedIn and company websites. Draft personalized outreach emails. Follow up on replies and schedule demos. Maintain CRM hygiene.",
    boundaries: [
      "Never make pricing commitments",
      "Maximum 30 outreach emails per day",
      "Always verify prospect title before outreach",
      "Never contact competitors' employees",
    ],
    approvalRules: {
      send_email: "critical",
      draft_response: "non_critical",
      search_knowledge: "non_critical",
      summarize: "non_critical",
    },
  },
  {
    id: "e_018f9a52",
    name: "Meera",
    role: "research_analyst",
    roleName: "Research Analyst",
    templateId: "t_ra",
    status: "active",
    state: "idle",
    avatarColor: "#8b5cf6",
    createdAt: "2025-01-16T14:00:00Z",
    activatedAt: "2025-01-16T14:30:00Z",
    taskCount: 19,
    completedTasks: 19,
    tokenUsage: 456000,
    tokenCap: 3000000,
    tools: ["search_knowledge", "summarize", "draft_response"],
    pendingApprovals: 0,
    jobDescription:
      "Research market trends, competitor moves, and industry reports. Summarize findings into briefings for the leadership team. Maintain a research knowledge base.",
    boundaries: [
      "Only use publicly available sources",
      "Never access paid databases without approval",
      "Cite all sources",
      "Maximum 5 research briefings per week",
    ],
    approvalRules: {
      draft_response: "non_critical",
      search_knowledge: "non_critical",
      summarize: "non_critical",
    },
  },
  {
    id: "e_018f9a53",
    name: "Vikram",
    role: "customer_support_agent",
    roleName: "Customer Support Agent",
    templateId: "t_csa",
    status: "paused",
    state: "paused",
    avatarColor: "#ec4899",
    createdAt: "2025-01-10T08:00:00Z",
    activatedAt: "2025-01-10T08:30:00Z",
    taskCount: 67,
    completedTasks: 65,
    tokenUsage: 2103000,
    tokenCap: 5000000,
    tools: ["draft_response", "send_email", "search_knowledge"],
    pendingApprovals: 0,
    jobDescription:
      "Handle Tier 2 customer escalations. Draft resolution emails and coordinate with the logistics team for shipping issues.",
    boundaries: [
      "Escalate legal threats immediately",
      "Maximum 30 emails per day",
      "Never authorize replacements over ₹5,000",
    ],
    approvalRules: {
      send_email: "critical",
      draft_response: "non_critical",
      search_knowledge: "non_critical",
    },
  },
  {
    id: "e_018f9a54",
    name: "Priya",
    role: "sales_development_representative",
    roleName: "Sales Development Rep",
    templateId: "t_sdr",
    status: "retired",
    state: "idle",
    avatarColor: "#64748b",
    createdAt: "2024-12-01T10:00:00Z",
    activatedAt: "2024-12-01T10:30:00Z",
    taskCount: 124,
    completedTasks: 120,
    tokenUsage: 3890000,
    tokenCap: 5000000,
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
    pendingApprovals: 0,
    jobDescription: "Outbound SDR for the North India region. Retired after Q4 campaign completion.",
    boundaries: ["Retired — read-only configuration"],
    approvalRules: { send_email: "critical", draft_response: "non_critical" },
  },
];

export const TASKS: Task[] = [
  {
    id: "t_018f9a60",
    title: "Draft replies to today's pending customer queries",
    description:
      "Process the support inbox and draft replies for 12 pending customer queries. Flag any refund requests above ₹2,000 for approval before sending.",
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    status: "waiting_approval",
    priority: "high",
    stepCount: 7,
    stepCap: 20,
    tokenUsage: 8420,
    tokenCap: 100000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-28T10:20:00Z",
    completedAt: null,
    steps: [
      {
        stepNumber: 1,
        stepType: "plan",
        reasoning:
          "I will search the knowledge base for the returns policy, then process each query in the inbox, drafting responses grounded in the policy. Emails will be flagged for approval before sending.",
        status: "completed",
        tokens: 420,
        durationMs: 3100,
      },
      {
        stepNumber: 2,
        stepType: "tool_call",
        reasoning:
          "Searched knowledge base for 'returns policy' and retrieved 3 relevant chunks from returns-policy.pdf.",
        tool: "search_knowledge",
        output: "3 chunks retrieved from returns-policy.pdf",
        status: "completed",
        tokens: 380,
        durationMs: 1200,
      },
      {
        stepNumber: 3,
        stepType: "reasoning",
        reasoning:
          "Query from Priya about order #2231: she wants to know the status. Order shipped yesterday via Delhivery, tracking DLV-8847. I'll draft a response with the tracking link.",
        status: "completed",
        tokens: 890,
        durationMs: 2400,
      },
      {
        stepNumber: 4,
        stepType: "tool_call",
        reasoning: "Drafted a response to Priya confirming shipment with tracking details.",
        tool: "draft_response",
        output: "Hi Priya, your order #2231 shipped on Jan 27 via Delhivery. Track it at delhivery.com/track/DLV-8847...",
        status: "completed",
        tokens: 640,
        durationMs: 1800,
      },
      {
        stepNumber: 5,
        stepType: "reasoning",
        reasoning:
          "Query from Rajesh about a refund for a damaged product (₹3,499). This exceeds my ₹2,000 authorization limit. I'll flag the refund email for human approval.",
        status: "completed",
        tokens: 720,
        durationMs: 2100,
      },
      {
        stepNumber: 6,
        stepType: "approval_gate",
        reasoning:
          "Approval required to send refund confirmation email to Rajesh for ₹3,499. The email proposes a full refund and a 15% discount on the next order.",
        tool: "send_email",
        status: "pending",
        tokens: 510,
        durationMs: 0,
      },
      {
        stepNumber: 7,
        stepType: "reasoning",
        reasoning: "5 remaining queries are being processed. Awaiting approval on the refund before continuing.",
        status: "pending",
        tokens: 0,
        durationMs: 0,
      },
    ],
  },
  {
    id: "t_018f9a61",
    title: "Research 15 prospects in the logistics sector",
    description:
      "Identify 15 mid-size logistics companies in South India. Research their current tech stack and draft personalized outreach emails for each.",
    employeeId: "e_018f9a51",
    employeeName: "Arjun",
    status: "executing",
    priority: "medium",
    stepCount: 9,
    stepCap: 25,
    tokenUsage: 12300,
    tokenCap: 150000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-28T09:15:00Z",
    completedAt: null,
  },
  {
    id: "t_018f9a62",
    title: "Summarize Q4 competitor pricing report",
    description:
      "Research and summarize the Q4 pricing changes across 5 competitors. Deliver a 2-page briefing for the leadership review on Friday.",
    employeeId: "e_018f9a52",
    employeeName: "Meera",
    status: "completed",
    priority: "medium",
    stepCount: 6,
    stepCap: 15,
    tokenUsage: 6800,
    tokenCap: 80000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-27T14:00:00Z",
    completedAt: "2025-01-27T16:45:00Z",
  },
  {
    id: "t_018f9a63",
    title: "Follow up on 8 warm leads from last week",
    description: "Send follow-up emails to 8 prospects who opened the initial outreach but did not reply.",
    employeeId: "e_018f9a51",
    employeeName: "Arjun",
    status: "waiting_approval",
    priority: "high",
    stepCount: 4,
    stepCap: 20,
    tokenUsage: 5400,
    tokenCap: 100000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-28T11:00:00Z",
    completedAt: null,
  },
  {
    id: "t_018f9a64",
    title: "Process weekend customer escalations",
    description: "Review and respond to 5 escalation tickets that came in over the weekend.",
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    status: "completed",
    priority: "high",
    stepCount: 12,
    stepCap: 20,
    tokenUsage: 14200,
    tokenCap: 100000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-27T09:00:00Z",
    completedAt: "2025-01-27T11:30:00Z",
  },
  {
    id: "t_018f9a65",
    title: "Compile monthly research digest",
    description: "Create a monthly digest of industry news, competitor moves, and market signals.",
    employeeId: "e_018f9a52",
    employeeName: "Meera",
    status: "failed",
    priority: "low",
    stepCount: 3,
    stepCap: 15,
    tokenUsage: 3200,
    tokenCap: 80000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-26T10:00:00Z",
    completedAt: null,
  },
  {
    id: "t_018f9a66",
    title: "Draft onboarding welcome sequence for new SaaS clients",
    description: "Create a 3-email welcome sequence for clients who sign up for the enterprise plan.",
    employeeId: "e_018f9a53",
    employeeName: "Vikram",
    status: "stopped",
    priority: "medium",
    stepCount: 2,
    stepCap: 15,
    tokenUsage: 1800,
    tokenCap: 80000,
    assignedBy: "Rohit Sharma",
    startedAt: "2025-01-25T13:00:00Z",
    completedAt: null,
  },
];

export const APPROVALS: Approval[] = [
  {
    id: "a_018f9a70",
    taskId: "t_018f9a60",
    taskTitle: "Draft replies to today's pending customer queries",
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    tool: "send_email",
    toolDisplayName: "Send Email",
    proposedAction: {
      to: "rajesh.kumar@gmail.com",
      subject: "Re: Refund request for order #2198 — damaged product",
      body: "Dear Rajesh, thank you for reaching out about the damaged product in order #2198. I sincerely apologize for the inconvenience. I've processed a full refund of ₹3,499 to your original payment method, which should reflect in 5-7 business days. Additionally, I've added a 15% discount code (WELCOME15) to your account for your next purchase. We take product quality seriously and have flagged this with our logistics team. Please let me know if there's anything else I can help with. Best regards, Saanvi (on behalf of Acme Trading)",
    },
    status: "pending",
    createdAt: "2025-01-28T10:24:00Z",
    timeoutAt: "2025-01-28T22:00:00Z",
    criticality: "critical",
  },
  {
    id: "a_018f9a71",
    taskId: "t_018f9a63",
    taskTitle: "Follow up on 8 warm leads from last week",
    employeeId: "e_018f9a51",
    employeeName: "Arjun",
    tool: "send_email",
    toolDisplayName: "Send Email",
    proposedAction: {
      to: "anita@bluedart-logistics.in",
      subject: "Re: Your interest in Acme's logistics automation platform",
      body: "Hi Anita, I noticed you opened our previous email about Acme's automation platform. Many logistics teams in South India are using our tool to reduce manual dispatch errors by up to 40%. Would you have 20 minutes this Thursday for a quick demo? I can show you how BlueDart-sized operations integrate our API in under a week. Best, Arjun",
    },
    status: "pending",
    createdAt: "2025-01-28T11:12:00Z",
    timeoutAt: "2025-01-29T11:00:00Z",
    criticality: "critical",
  },
  {
    id: "a_018f9a72",
    taskId: "t_018f9a64",
    taskTitle: "Process weekend customer escalations",
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    tool: "send_email",
    toolDisplayName: "Send Email",
    proposedAction: {
      to: "deepak@sundar-electronics.in",
      subject: "Re: Escalation — order delayed by 12 days",
      body: "Dear Mr. Sundar, I deeply apologize for the unacceptable delay on order #3321. I've personally tracked the shipment and confirmed it will arrive by tomorrow 6 PM. As a gesture of goodwill, I've issued a ₹500 store credit. We've also filed a formal complaint with our courier partner.",
    },
    status: "approved",
    createdAt: "2025-01-27T10:30:00Z",
    timeoutAt: "2025-01-27T22:00:00Z",
    decidedBy: "Rohit Sharma",
    decidedAt: "2025-01-27T10:35:00Z",
    decision: "approved",
    reason: "Good response — personal and empathetic.",
    criticality: "critical",
  },
  {
    id: "a_018f9a73",
    taskId: "t_018f9a61",
    taskTitle: "Research 15 prospects in the logistics sector",
    employeeId: "e_018f9a51",
    employeeName: "Arjun",
    tool: "send_email",
    toolDisplayName: "Send Email",
    proposedAction: {
      to: "cto@fastfreight.in",
      subject: "Acme + FastFreight: reducing dispatch errors by 40%",
      body: "Hi, I saw FastFreight's recent expansion into Tamil Nadu. Acme helps logistics companies like yours automate dispatch routing and reduce manual errors...",
    },
    status: "rejected",
    createdAt: "2025-01-28T09:45:00Z",
    timeoutAt: "2025-01-28T21:00:00Z",
    decidedBy: "Rohit Sharma",
    decidedAt: "2025-01-28T09:50:00Z",
    decision: "rejected",
    reason: "Tone is too generic. Personalize with FastFreight's specific expansion news.",
    criticality: "critical",
  },
  {
    id: "a_018f9a74",
    taskId: "t_018f9a64",
    taskTitle: "Process weekend customer escalations",
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    tool: "send_email",
    toolDisplayName: "Send Email",
    proposedAction: {
      to: "lakshmi@nair-textiles.in",
      subject: "Re: Wrong item delivered — order #3401",
      body: "Dear Lakshmi, I apologize for the mix-up. A replacement for the correct item has been dispatched and will arrive in 2 days. Please keep the wrong item at no charge.",
    },
    status: "modified",
    createdAt: "2025-01-27T11:00:00Z",
    timeoutAt: "2025-01-27T23:00:00Z",
    decidedBy: "Rohit Sharma",
    decidedAt: "2025-01-27T11:10:00Z",
    decision: "modified",
    reason: "Added tracking link and extended the timeline to 3 days to be safe.",
    criticality: "critical",
  },
  {
    id: "a_018f9a75",
    taskId: "t_018f9a62",
    taskTitle: "Summarize Q4 competitor pricing report",
    employeeId: "e_018f9a52",
    employeeName: "Meera",
    tool: "draft_response",
    toolDisplayName: "Draft Response",
    proposedAction: {
      output: "Q4 Competitor Pricing Briefing: Competitor A raised prices 8%, Competitor B introduced a freemium tier...",
    },
    status: "expired",
    createdAt: "2025-01-26T16:00:00Z",
    timeoutAt: "2025-01-27T04:00:00Z",
    criticality: "non_critical",
  },
];

export const AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: "au_142",
    sequenceNumber: 142,
    entryType: "approval_decided",
    actorType: "user",
    actorName: "Rohit Sharma",
    targetType: "approval",
    targetId: "a_018f9a70",
    payload: { decision: "pending", tool: "send_email", employee: "Saanvi" },
    previousHash: "9f2c4e1a8b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e",
    entryHash: "b7a4f88c2d1e9f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
    createdAt: "2025-01-28T10:24:00Z",
  },
  {
    id: "au_141",
    sequenceNumber: 141,
    entryType: "approval_requested",
    actorType: "employee",
    actorName: "Saanvi",
    targetType: "approval",
    targetId: "a_018f9a70",
    payload: { tool: "send_email", task: "Draft replies to today's pending queries", criticality: "critical" },
    previousHash: "3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    entryHash: "9f2c4e1a8b7d6c5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e",
    createdAt: "2025-01-28T10:23:58Z",
  },
  {
    id: "au_140",
    sequenceNumber: 140,
    entryType: "step_executed",
    actorType: "employee",
    actorName: "Saanvi",
    targetType: "task_step",
    targetId: "t_018f9a60_step5",
    payload: { step: 5, type: "reasoning", tokens: 720, task: "Draft replies to today's pending queries" },
    previousHash: "7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
    entryHash: "3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    createdAt: "2025-01-28T10:23:30Z",
  },
  {
    id: "au_139",
    sequenceNumber: 139,
    entryType: "tool_executed",
    actorType: "employee",
    actorName: "Saanvi",
    targetType: "task_step",
    targetId: "t_018f9a60_step4",
    payload: { tool: "draft_response", status: "completed", task: "Draft replies to today's pending queries" },
    previousHash: "5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    entryHash: "7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
    createdAt: "2025-01-28T10:23:04Z",
  },
  {
    id: "au_138",
    sequenceNumber: 138,
    entryType: "llm_call",
    actorType: "system",
    actorName: "LLM Gateway",
    targetType: "task_step",
    targetId: "t_018f9a60_step4",
    payload: { model: "gpt-4o-mini", tokens: 640, cost_cents: "1", latency_ms: "1800" },
    previousHash: "1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    entryHash: "5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    createdAt: "2025-01-28T10:23:02Z",
  },
  {
    id: "au_137",
    sequenceNumber: 137,
    entryType: "step_executed",
    actorType: "employee",
    actorName: "Saanvi",
    targetType: "task_step",
    targetId: "t_018f9a60_step3",
    payload: { step: 3, type: "reasoning", tokens: 890 },
    previousHash: "9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
    entryHash: "1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    createdAt: "2025-01-28T10:22:45Z",
  },
  {
    id: "au_136",
    sequenceNumber: 136,
    entryType: "task_started",
    actorType: "user",
    actorName: "Rohit Sharma",
    targetType: "task",
    targetId: "t_018f9a60",
    payload: { title: "Draft replies to today's pending queries", employee: "Saanvi", config_version: "3" },
    previousHash: "d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
    entryHash: "9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f",
    createdAt: "2025-01-28T10:20:00Z",
  },
  {
    id: "au_135",
    sequenceNumber: 135,
    entryType: "employee_resumed",
    actorType: "user",
    actorName: "Rohit Sharma",
    targetType: "employee",
    targetId: "e_018f9a50",
    payload: { employee: "Saanvi", prior_state: "paused" },
    previousHash: "b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    entryHash: "d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
    createdAt: "2025-01-28T10:19:00Z",
  },
];

export const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: "d_018f9a80",
    filename: "returns-policy.pdf",
    contentType: "application/pdf",
    sizeBytes: 184320,
    status: "ready",
    chunkCount: 24,
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-12T10:05:00Z",
  },
  {
    id: "d_018f9a81",
    filename: "product-catalog-2025.pdf",
    contentType: "application/pdf",
    sizeBytes: 2456789,
    status: "ready",
    chunkCount: 156,
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-12T10:06:00Z",
  },
  {
    id: "d_018f9a82",
    filename: "faq-knowledge-base.md",
    contentType: "text/markdown",
    sizeBytes: 45200,
    status: "ready",
    chunkCount: 18,
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-13T09:00:00Z",
  },
  {
    id: "d_018f9a83",
    filename: "competitor-analysis-q4.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 892400,
    status: "ready",
    chunkCount: 67,
    employeeId: "e_018f9a52",
    employeeName: "Meera",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-16T14:05:00Z",
  },
  {
    id: "d_018f9a84",
    filename: "sales-playbook-2025.pdf",
    contentType: "application/pdf",
    sizeBytes: 1204500,
    status: "ready",
    chunkCount: 89,
    employeeId: "e_018f9a51",
    employeeName: "Arjun",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-14T09:10:00Z",
  },
  {
    id: "d_018f9a85",
    filename: "shipping-rates-matrix.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 67800,
    status: "processing",
    chunkCount: 0,
    employeeId: "e_018f9a50",
    employeeName: "Saanvi",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-28T10:50:00Z",
  },
  {
    id: "d_018f9a86",
    filename: "industry-report-logistics.txt",
    contentType: "text/plain",
    sizeBytes: 234000,
    status: "failed",
    chunkCount: 0,
    employeeId: "e_018f9a52",
    employeeName: "Meera",
    uploadedBy: "Rohit Sharma",
    createdAt: "2025-01-27T15:00:00Z",
  },
];

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n_1",
    type: "approval_pending",
    title: "Saanvi needs your approval",
    body: "Send email to rajesh.kumar@gmail.com — refund of ₹3,499",
    referenceType: "approval",
    referenceId: "a_018f9a70",
    read: false,
    createdAt: "2025-01-28T10:24:00Z",
  },
  {
    id: "n_2",
    type: "approval_pending",
    title: "Arjun needs your approval",
    body: "Send follow-up email to anita@bluedart-logistics.in",
    referenceType: "approval",
    referenceId: "a_018f9a71",
    read: false,
    createdAt: "2025-01-28T11:12:00Z",
  },
  {
    id: "n_3",
    type: "task_completed",
    title: "Meera completed a task",
    body: "Q4 competitor pricing report — 2-page briefing delivered",
    referenceType: "task",
    referenceId: "t_018f9a62",
    read: false,
    createdAt: "2025-01-27T16:45:00Z",
  },
  {
    id: "n_4",
    type: "task_failed",
    title: "Meera's task failed",
    body: "Monthly research digest failed — token cap exceeded",
    referenceType: "task",
    referenceId: "t_018f9a65",
    read: true,
    createdAt: "2025-01-26T14:30:00Z",
  },
  {
    id: "n_5",
    type: "employee_paused",
    title: "Vikram was paused",
    body: "You paused Vikram (Customer Support Agent)",
    referenceType: "employee",
    referenceId: "e_018f9a53",
    read: true,
    createdAt: "2025-01-25T16:00:00Z",
  },
];

// Dashboard chart data — task activity over 14 days
export const TASK_ACTIVITY = [
  { day: "Jan 15", tasks: 4, tokens: 32000 },
  { day: "Jan 16", tasks: 6, tokens: 48000 },
  { day: "Jan 17", tasks: 3, tokens: 21000 },
  { day: "Jan 18", tasks: 7, tokens: 56000 },
  { day: "Jan 19", tasks: 2, tokens: 14000 },
  { day: "Jan 20", tasks: 1, tokens: 8000 },
  { day: "Jan 21", tasks: 5, tokens: 39000 },
  { day: "Jan 22", tasks: 8, tokens: 67000 },
  { day: "Jan 23", tasks: 6, tokens: 52000 },
  { day: "Jan 24", tasks: 4, tokens: 31000 },
  { day: "Jan 25", tasks: 3, tokens: 22000 },
  { day: "Jan 26", tasks: 2, tokens: 16000 },
  { day: "Jan 27", tasks: 9, tokens: 78000 },
  { day: "Jan 28", tasks: 5, tokens: 42000 },
];

// Token usage by employee (for donut chart)
export const TOKEN_USAGE_BY_EMPLOYEE = [
  { name: "Saanvi", value: 1245000, color: "#10b981" },
  { name: "Arjun", value: 892000, color: "#f59e0b" },
  { name: "Meera", value: 456000, color: "#8b5cf6" },
  { name: "Vikram", value: 2103000, color: "#ec4899" },
  { name: "Priya", value: 3890000, color: "#64748b" },
];

export const DASHBOARD_STATS = {
  employees: { total: 5, active: 3, paused: 1, retired: 1 },
  tasks: { total: 190, inProgress: 2, waitingApproval: 2, completed: 176, failed: 2, stopped: 1 },
  approvals: { pending: 2, decidedToday: 3, approvalRate: 0.83, rejectedToday: 1 },
  tokens: { usedThisMonth: 2596000, costCentsThisMonth: 2596, budgetCentsThisMonth: 10000 },
  documents: { total: 7, ready: 5, processing: 1, failed: 1 },
};

export const TEMPLATES = [
  {
    id: "t_csa",
    name: "Customer Support Agent",
    role: "customer_support_agent" as RoleKey,
    description: "Drafts and routes customer replies under human approval.",
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
  },
  {
    id: "t_sdr",
    name: "Sales Development Rep",
    role: "sales_development_representative" as RoleKey,
    description: "Researches prospects and drafts personalized outreach emails.",
    tools: ["draft_response", "send_email", "search_knowledge", "summarize"],
  },
  {
    id: "t_ra",
    name: "Research Analyst",
    role: "research_analyst" as RoleKey,
    description: "Researches market trends and produces briefings for leadership.",
    tools: ["search_knowledge", "summarize", "draft_response"],
  },
];

export const TOOLS = [
  {
    id: "tool_1",
    name: "draft_response",
    displayName: "Draft Response",
    description: "Drafts a response for review without sending.",
    defaultCriticality: "non_critical" as const,
  },
  {
    id: "tool_2",
    name: "send_email",
    displayName: "Send Email",
    description: "Sends an email on behalf of the employee. Always critical.",
    defaultCriticality: "critical" as const,
  },
  {
    id: "tool_3",
    name: "search_knowledge",
    displayName: "Search Knowledge",
    description: "Searches uploaded knowledge documents for grounding.",
    defaultCriticality: "non_critical" as const,
  },
  {
    id: "tool_4",
    name: "summarize",
    displayName: "Summarize",
    description: "Summarizes long content into a brief.",
    defaultCriticality: "non_critical" as const,
  },
];
