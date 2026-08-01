import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";
import { appendAudit } from "@/lib/runtime/audit";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const role = url.searchParams.get("role");
    const q = url.searchParams.get("q");

    const employees = await db.employee.findMany({
      where: {
        workspaceId,
        ...(status && status !== "all" ? { status } : {}),
        ...(role ? { role } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Load profiles + current tasks for business-metric-first cards (MVP-001)
    const employeeIds = employees.map((e) => e.id);
    const [profiles, activeTasks] = await Promise.all([
      db.employeeProfile.findMany({ where: { employeeId: { in: employeeIds } } }),
      db.task.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: { in: ["queued", "planning", "executing", "waiting_approval"] },
        },
        select: { id: true, employeeId: true, title: true, status: true },
      }),
    ]);
    const profileMap = new Map(profiles.map((p) => [p.employeeId, p]));
    const taskMap = new Map(activeTasks.map((t) => [t.employeeId, t]));

    const data = employees.map((e) => {
      const profile = profileMap.get(e.id);
      const currentTask = taskMap.get(e.id);
      return {
        id: e.id,
        name: e.name,
        role: e.role,
        roleName: ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] || e.role,
        templateId: e.templateId,
        status: e.status,
        state: e.state,
        avatarColor: AVATAR_COLORS[e.name] || "#10b981",
        createdAt: e.createdAt,
        activatedAt: e.activatedAt,
        retiredAt: e.retiredAt,
        taskCount: e.taskCount,
        completedTasks: e.completedTasks,
        tokenUsage: e.tokenUsage,
        tokenCap: e.tokenCap,
        tools: JSON.parse(e.tools) as string[],
        pendingApprovals: e.pendingApprovals,
        jobDescription: e.jobDescription,
        boundaries: JSON.parse(e.boundaries) as string[],
        approvalRules: JSON.parse(e.approvalRules) as Record<string, string>,
        // ─── Business metrics from the profile (MVP-001) ───
        // These are what the card shows FIRST — not XP or token usage.
        trustScore: profile?.trustScore || 0,
        level: profile?.level || 1,
        title: profile?.title || "Intern",
        experiencePoints: profile?.experiencePoints || 0,
        profileCompletedTasks: profile?.completedTasks || 0,
        tasksAutomated: profile?.tasksAutomated || 0,
        emailsSent: profile?.emailsSent || 0,
        customersHandled: profile?.customersHandled || 0,
        hoursSaved: profile?.hoursSaved || 0,
        moneyRecovered: profile?.moneyRecovered || 0,
        approvalRate: profile?.approvalRate || 1,
        // Current task (if actively working)
        currentTaskId: currentTask?.id || null,
        currentTaskTitle: currentTask?.title || null,
        currentTaskStatus: currentTask?.status || null,
      };
    });

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { name, templateId, role, jobDescription, operatingBoundaries, approvalRules, toolNames } = body;

    const template = templateId ? await db.employeeTemplate.findUnique({ where: { id: templateId } }) : null;
    if (templateId && !template) {
      return error("NOT_FOUND", "Template not found.", 404);
    }

    const employeeRole = role || template?.role || "customer_support_agent";

    const employee = await db.employee.create({
      data: {
        workspaceId,
        name,
        role: employeeRole,
        templateId: template?.id || null,
        status: "active",
        state: "idle",
        jobDescription: jobDescription || template?.defaultJobDescription || "",
        boundaries: JSON.stringify(operatingBoundaries || []),
        approvalRules: JSON.stringify(approvalRules || JSON.parse(template?.defaultApprovalRules || "{}")),
        tools: JSON.stringify(toolNames || JSON.parse(template?.defaultToolNames || "[]")),
        tokenCap: 5000000,
        createdBy: user.id,
        activatedAt: new Date(),
      },
    });

    // If this is a Finance Employee, grant finance capabilities + tool permissions
    // + initialize the profile (reuses the Capability Engine + Profile Engine)
    if (employeeRole === "finance_employee") {
      const { seedCapabilities, grantFinanceCapabilities } = await import("@/lib/capabilities/engine");
      const { initProfile } = await import("@/lib/profile/engine");
      await seedCapabilities();
      await grantFinanceCapabilities(employee.id, user.id);
      await initProfile(employee.id, workspaceId, "finance_employee", "Finance");

      // Grant tool permissions (same as seed.ts)
      const financeTools = await db.tool.findMany({
        where: { name: { in: ["generate_reminder", "send_reminder", "update_collection_case", "search_knowledge"] } },
      });
      for (const tool of financeTools) {
        await db.employeeToolPermission.create({
          data: { employeeId: employee.id, toolId: tool.id, grantedBy: user.id },
        });
      }
    }

    // Audit (hash-chained via the shared Audit Chain — reuses existing architecture)
    await db.$transaction(async (tx) => {
      await appendAudit(tx, {
        workspaceId,
        entryType: "employee_created",
        actorType: "user",
        actorId: user.id,
        actorName: user.name,
        targetType: "employee",
        targetId: employee.id,
        payload: { employee: name, role: employee.role },
      });
    });

    return success(employee, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

const ROLE_LABELS = {
  customer_support_agent: "Customer Support Agent",
  sales_development_representative: "Sales Development Rep",
  research_analyst: "Research Analyst",
  finance_employee: "Finance Employee",
};

const AVATAR_COLORS: Record<string, string> = {
  Saanvi: "#10b981",
  Arjun: "#f59e0b",
  Meera: "#8b5cf6",
  Vikram: "#ec4899",
  Priya: "#64748b",
};
