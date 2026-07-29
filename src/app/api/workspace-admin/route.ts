import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const [members, departments, policies, rules, integrations] = await Promise.all([
      db.workspaceMember.findMany({
        where: { workspaceId, status: "active" },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      }),
      db.department.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
      db.policy.count({ where: { workspaceId, status: "active" } }),
      db.approvalRule.count({ where: { workspaceId, status: "active" } }),
      db.integration.findMany({ where: { workspaceId, status: "connected" } }),
    ]);

    const memberData = members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));

    return success({
      members: memberData,
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        headUserId: d.headUserId,
      })),
      stats: {
        memberCount: members.length,
        departmentCount: departments.length,
        activePolicies: policies,
        activeRules: rules,
        connectedIntegrations: integrations.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
