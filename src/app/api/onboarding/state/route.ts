import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";

/**
 * MVP-001 — Onboarding State API
 *
 * Returns whether the current workspace has completed onboarding.
 * The frontend uses this to decide whether to redirect to the onboarding
 * wizard or show the dashboard.
 *
 * Onboarding is considered "completed" if the workspace has at least one
 * active employee (created via the onboarding wizard or seed script).
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);

    const [employeeCount, invoiceCount, customerCount, taskCount] = await Promise.all([
      db.employee.count({ where: { workspaceId, status: "active" } }),
      db.invoice.count({ where: { workspaceId } }),
      db.customer.count({ where: { workspaceId } }),
      db.task.count({ where: { workspaceId } }),
    ]);

    const completed = employeeCount > 0;
    const hasFinanceEmployee = (await db.employee.count({
      where: { workspaceId, role: "finance_employee", status: "active" },
    })) > 0;

    return success({
      completed,
      hasFinanceEmployee,
      employeeCount,
      invoiceCount,
      customerCount,
      taskCount,
      // If the workspace has no employees AND no invoices, it's a fresh
      // workspace that should be redirected to onboarding.
      needsOnboarding: !completed && invoiceCount === 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
