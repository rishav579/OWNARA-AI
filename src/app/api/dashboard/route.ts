import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const [employees, tasks, approvals, documents, llmUsage, auditLogs, trustScores, policies, businessActivity] = await Promise.all([
      db.employee.findMany({ where: { workspaceId } }),
      db.task.findMany({ where: { workspaceId } }),
      db.approval.findMany({ where: { workspaceId } }),
      db.knowledgeDocument.findMany({ where: { workspaceId } }),
      db.llmUsage.findMany({ where: { workspaceId } }),
      db.auditLog.findMany({
        where: { workspaceId },
        orderBy: { sequenceNumber: "desc" },
        take: 6,
      }),
      db.trustScore.findMany({ where: { workspaceId }, include: { employee: true } }),
      db.policy.count({ where: { workspaceId, status: "active" } }),
      db.auditLog.findMany({ where: { workspaceId }, orderBy: { sequenceNumber: "desc" }, take: 8 }),
    ]);

    // Finance metrics (live data from AR domain)
    const [invoices, customers, payments, reminders, collectionCases] = await Promise.all([
      db.invoice.findMany({ where: { workspaceId }, include: { customer: true, payments: { where: { status: "completed" } } } }),
      db.customer.findMany({ where: { workspaceId }, include: { invoices: true } }),
      db.payment.findMany({ where: { workspaceId, status: "completed" }, orderBy: { paymentDate: "desc" } }),
      db.reminder.findMany({ where: { workspaceId } }),
      db.collectionCase.findMany({ where: { workspaceId, status: { in: ["open", "escalated"] } } }),
    ]);

    // Employee profiles (for business impact KPIs — MVP-001)
    const employeeProfiles = await db.employeeProfile.findMany({
      where: { workspaceId },
    });
    const profileByEmployee = new Map(employeeProfiles.map((p) => [p.employeeId, p]));

    // Calculate finance metrics
    const outstandingReceivables = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
    const overdueInvoices = invoices.filter((inv) => {
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return due < now && inv.outstanding > 0;
    });
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.outstanding, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recoveredThisWeek = payments.filter((p) => new Date(p.paymentDate) >= weekAgo).reduce((sum, p) => sum + p.amount, 0);
    const customersAtRisk = customers.filter((c) => c.riskLevel === "high" || c.invoices.filter((inv) => {
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return due < now && inv.outstanding > 0;
    }).length >= 2).length;

    // ─── Business Impact KPIs (MVP-001) ────────────────────────────────────
    // Aggregate from employee profiles — these are the metrics that matter
    // to a business owner, not XP or token usage.
    const totalMoneyPending = outstandingReceivables;
    const totalInvoicesProcessed = employeeProfiles.reduce((s, p) => s + p.invoicesProcessed, 0);
    const totalCustomersContacted = employeeProfiles.reduce((s, p) => s + p.customersHandled, 0);
    const totalHoursSaved = employeeProfiles.reduce((s, p) => s + p.hoursSaved, 0);
    const totalEmailsSent = employeeProfiles.reduce((s, p) => s + p.emailsSent, 0);
    const totalMoneyRecovered = employeeProfiles.reduce((s, p) => s + p.moneyRecovered, 0);
    const totalTasksAutomated = employeeProfiles.reduce((s, p) => s + p.tasksAutomated, 0);

    // Automation % = tasks that completed without human corrections / total tasks
    // Human Approval % = approvals that were approved / total decisions
    const totalDecisions = approvals.filter((a) => a.status !== "pending").length;
    const approvedDecisions = approvals.filter((a) => a.status === "approved" || a.status === "modified").length;
    const humanApprovalRate = totalDecisions > 0 ? approvedDecisions / totalDecisions : 0;

    // Average trust score across all employees with profiles
    const employeesWithProfiles = employees.filter((e) => profileByEmployee.has(e.id));
    const avgTrustScore = employeesWithProfiles.length > 0
      ? employeesWithProfiles.reduce((s, e) => s + (profileByEmployee.get(e.id)?.trustScore || 0), 0) / employeesWithProfiles.length
      : 0;

    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const pausedEmployees = employees.filter((e) => e.status === "paused").length;
    const retiredEmployees = employees.filter((e) => e.status === "retired").length;

    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const stoppedTasks = tasks.filter((t) => t.status === "stopped").length;
    const inProgress = tasks.filter((t) => ["assigned", "planning", "executing"].includes(t.status)).length;
    const waitingApproval = tasks.filter((t) => t.status === "waiting_approval").length;

    // Automation rate = completed tasks / (completed + failed + stopped)
    const automationRate = completedTasks + failedTasks + stoppedTasks > 0
      ? completedTasks / (completedTasks + failedTasks + stoppedTasks)
      : 0;

    const pendingApprovals = approvals.filter((a) => a.status === "pending");
    const decidedToday = approvals.filter((a) => a.decidedAt && isToday(a.decidedAt)).length;
    const rejectedToday = approvals.filter((a) => a.decidedAt && isToday(a.decidedAt) && a.decision === "rejected").length;
    const totalDecided = approvals.filter((a) => a.status !== "pending").length;
    const approvalRate = totalDecided > 0 ? approvals.filter((a) => a.status === "approved" || a.status === "modified").length / totalDecided : 0;

    const totalTokens = llmUsage.reduce((s, u) => s + u.totalTokens, 0);
    const totalCostCents = llmUsage.reduce((s, u) => s + u.costCents, 0);

    // Token usage by employee
    const tokenByEmployee = employees.map((e) => ({
      name: e.name,
      value: e.tokenUsage,
      color: AVATAR_COLORS[e.name] || "#64748b",
    })).sort((a, b) => b.value - a.value);

    // Recent activity
    const recentActivity = auditLogs.map((e) => ({
      id: e.id,
      sequenceNumber: e.sequenceNumber,
      entryType: e.entryType,
      actorType: e.actorType,
      actorName: e.actorName,
      targetType: e.targetType,
      targetId: e.targetId,
      payload: JSON.parse(e.payload),
      createdAt: e.createdAt,
    }));

    // Business activity (translated)
    const businessFeed = businessActivity.map((e) => {
      const payload = JSON.parse(e.payload);
      return translateBusiness(e.entryType, e.actorName, e.actorType, payload, e.targetType, e.id, e.sequenceNumber, e.createdAt);
    });

    // Trust scores
    const trustData = trustScores.map((s) => ({
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      avatarColor: AVATAR_COLORS[s.employee.name] || "#10b981",
      overallScore: s.overallScore,
      trend: s.trend,
      trendDelta: s.trendDelta,
      successRate: s.successRate,
      approvalRate: s.approvalRate,
      policyViolations: s.policyViolations,
      humanCorrections: s.humanCorrections,
    }));

    return success({
      employees: {
        total: employees.length,
        active: activeEmployees,
        paused: pausedEmployees,
        retired: retiredEmployees,
        list: employees.filter((e) => e.status === "active").map((e) => {
          const profile = profileByEmployee.get(e.id);
          // Find the employee's current active task (if any)
          const currentTask = tasks.find((t) => t.employeeId === e.id && ["queued", "planning", "executing", "waiting_approval"].includes(t.status));
          return {
            id: e.id,
            name: e.name,
            role: e.role,
            roleName: ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] || e.role,
            status: e.status,
            state: e.state,
            avatarColor: AVATAR_COLORS[e.name] || "#10b981",
            pendingApprovals: e.pendingApprovals,
            // Business metrics from the profile (MVP-001)
            trustScore: profile?.trustScore || 0,
            level: profile?.level || 1,
            title: profile?.title || "Intern",
            completedTasks: profile?.completedTasks || 0,
            tasksAutomated: profile?.tasksAutomated || 0,
            emailsSent: profile?.emailsSent || 0,
            customersHandled: profile?.customersHandled || 0,
            hoursSaved: profile?.hoursSaved || 0,
            moneyRecovered: profile?.moneyRecovered || 0,
            approvalRate: profile?.approvalRate || 1,
            // Current task info
            currentTaskId: currentTask?.id || null,
            currentTaskTitle: currentTask?.title || null,
          };
        }),
      },
      tasks: {
        total: tasks.length,
        inProgress,
        waitingApproval,
        completed: completedTasks,
        failed: failedTasks,
        stopped: stoppedTasks,
      },
      approvals: {
        pending: pendingApprovals.length,
        decidedToday,
        rejectedToday,
        approvalRate,
        pendingList: pendingApprovals.map((a) => {
          const emp = employees.find((e) => e.id === a.employeeId);
          const task = tasks.find((t) => t.id === a.taskId);
          const proposed = JSON.parse(a.proposedAction);
          return {
            id: a.id,
            employeeName: emp?.name || "Unknown",
            employeeColor: emp ? AVATAR_COLORS[emp.name] || "#10b981" : "#10b981",
            toolDisplayName: a.toolDisplayName,
            to: proposed.to || proposed.subject || "Draft",
            taskId: a.taskId,
            taskTitle: task?.title || "",
          };
        }),
      },
      tokens: {
        usedThisMonth: totalTokens,
        costCentsThisMonth: totalCostCents,
        budgetCentsThisMonth: 10000,
        byEmployee: tokenByEmployee,
      },
      documents: {
        total: documents.length,
        ready: documents.filter((d) => d.status === "ready").length,
        processing: documents.filter((d) => d.status === "processing").length,
        failed: documents.filter((d) => d.status === "failed").length,
      },
      recentActivity,
      businessFeed,
      trustScores: trustData,
      activePolicies: policies,
      // Finance metrics (live data from AR domain)
      finance: {
        outstandingReceivables,
        overdueCount: overdueInvoices.length,
        totalOverdue,
        recoveredThisWeek,
        customersAtRisk,
        openCollectionCases: collectionCases.length,
        totalCustomers: customers.length,
        totalInvoices: invoices.length,
        totalRemindersSent: reminders.filter((r) => r.status === "sent").length,
      },
      // ─── Business Impact KPIs (MVP-001) ────────────────────────────────────
      // These are the metrics that matter to a business owner.
      // Aggregated from employee profiles + finance domain + approvals.
      businessImpact: {
        moneyPending: totalMoneyPending,
        moneyRecovered: totalMoneyRecovered,
        invoicesProcessed: totalInvoicesProcessed,
        customersContacted: totalCustomersContacted,
        hoursSaved: totalHoursSaved,
        emailsSent: totalEmailsSent,
        tasksAutomated: totalTasksAutomated,
        automationRate,          // 0-1: completed / (completed + failed + stopped)
        humanApprovalRate,       // 0-1: approved / total decisions
        avgTrustScore,           // 0-100: average across all employees
      },
      // Onboarding state (MVP-001) — used by the dashboard to show
      // the "Hire your first AI Employee" CTA when the workspace is empty.
      needsOnboarding: employees.length === 0,
      // Task activity over 14 days (from LLM usage as proxy)
      taskActivity: llmUsage.slice(-14).map((u, i) => ({
        day: `Jan ${15 + i}`,
        tasks: Math.max(1, Math.floor(u.totalTokens / 8000)),
        tokens: u.totalTokens,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function translateBusiness(entryType: string, actorName: string, actorType: string, payload: any, targetType: string | null, id: string, seq: number, createdAt: Date) {
  let event = entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let description = `${actorName} (${actorType}) performed an action.`;
  let category = "system";
  let severity = "info";

  if (entryType === "approval_requested") {
    event = "Approval Required";
    description = `${actorName} requested approval to ${payload.tool?.replace(/_/g, " ") || "perform an action"}.`;
    category = "approval";
    severity = payload.criticality === "critical" ? "warning" : "info";
  } else if (entryType === "approval_decided") {
    event = payload.decision === "approved" ? "Action Approved" : payload.decision === "rejected" ? "Action Rejected" : "Approval Under Review";
    description = `${actorName} ${payload.decision} the ${payload.tool?.replace(/_/g, " ") || "action"} for ${payload.employee || "an AI Employee"}.`;
    category = "approval";
    severity = payload.decision === "rejected" ? "warning" : payload.decision === "approved" ? "success" : "info";
  } else if (entryType === "task_started") {
    event = "Work Delegated";
    description = `${actorName} assigned "${payload.title}" to ${payload.employee}.`;
    category = "task";
  } else if (entryType === "task_completed") {
    event = "Task Completed";
    description = `${payload.employee || "An AI Employee"} completed a task.`;
    category = "task";
    severity = "success";
  } else if (entryType === "tool_executed") {
    event = "Tool Executed";
    description = `${actorName} used the ${payload.tool?.replace(/_/g, " ")} tool.`;
    category = "task";
  } else if (entryType === "llm_call") {
    event = "AI Model Called";
    description = `LLM Gateway called ${payload.model} (${payload.tokens} tokens).`;
    category = "system";
  } else if (entryType === "employee_resumed") {
    event = "AI Employee Resumed";
    description = `${actorName} resumed ${payload.employee}.`;
    category = "employee";
    severity = "success";
  }

  return { id, sequenceNumber: seq, entryType, actorName, actorType, targetType, targetId: null, payload, businessEvent: event, businessDescription: description, category, severity, createdAt };
}

function isToday(date: Date): boolean {
  const d = new Date(date);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const ROLE_LABELS = {
  customer_support_agent: "Customer Support Agent",
  sales_development_representative: "Sales Development Rep",
  research_analyst: "Research Analyst",
};

const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
};
