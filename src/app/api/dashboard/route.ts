import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const [employees, tasks, approvals, documents, llmUsage, auditLogs] = await Promise.all([
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
    ]);

    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const pausedEmployees = employees.filter((e) => e.status === "paused").length;
    const retiredEmployees = employees.filter((e) => e.status === "retired").length;

    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const stoppedTasks = tasks.filter((t) => t.status === "stopped").length;
    const inProgress = tasks.filter((t) => ["assigned", "planning", "executing"].includes(t.status)).length;
    const waitingApproval = tasks.filter((t) => t.status === "waiting_approval").length;

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

    return success({
      employees: {
        total: employees.length,
        active: activeEmployees,
        paused: pausedEmployees,
        retired: retiredEmployees,
        list: employees.filter((e) => e.status === "active").map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          roleName: ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] || e.role,
          status: e.status,
          state: e.state,
          avatarColor: AVATAR_COLORS[e.name] || "#10b981",
          pendingApprovals: e.pendingApprovals,
        })),
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
