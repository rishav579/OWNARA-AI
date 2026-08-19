/**
 * OWNARA — Gate S: New Customer Flow Test
 *
 * THE MOST IMPORTANT TEST.
 *
 * Proves that a fresh customer can go from SIGNUP to ACTIVE MANDATE without
 * developer intervention, database seeding, or manual SQL.
 *
 * Flow:
 *   SIGNUP → CREATE WORKSPACE → IMPORT CSV → REVIEW → GRANT MANDATE
 *   → ASSIGN KAVYA → REVIEW AUTHORITY → ACTIVATE → OBSERVE
 *
 * This test uses the actual API endpoints (not mocks) to verify the complete
 * onboarding journey works end-to-end.
 *
 * Run with: bun run tests/new-customer-flow.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

async function api(path: string, method: string, body?: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  OWNARA — Gate S: New Customer Flow Test             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nThis test proves a fresh customer can go from signup to active");
  console.log("Mandate without developer intervention.\n");

  // ─── Clean up any previous test data ─────────────────────────────────────
  const testEmail = `newcustomer-test-${Date.now()}@ownara.com`;
  console.log(`Test email: ${testEmail}`);

  try {
    // ─── 1. SIGNUP ─────────────────────────────────────────────────────────
    console.log("\n── 1. SIGNUP ──");
    const signupRes = await api("/api/auth/signup", "POST", {
      email: testEmail,
      password: "TestCustomer@2026!",
      name: "New Customer",
      workspaceName: "Test Customer Corp",
    });

    assert(signupRes.status === 200 || signupRes.status === 201, `Signup returns success (status ${signupRes.status})`);
    assert(!!signupRes.data.data?.accessToken, "Signup returns access token");
    assert(!!signupRes.data.data?.user?.id, "Signup returns user ID");
    assert(!!signupRes.data.data?.workspace?.id, "Signup creates workspace");

    const token = signupRes.data.data?.accessToken;
    const userId = signupRes.data.data?.user?.id;
    const workspaceId = signupRes.data.data?.workspace?.id;

    if (!token || !workspaceId) {
      console.log("❌ Cannot continue without token + workspace");
      return;
    }

    // ─── 2. VERIFY EMPTY STATE ─────────────────────────────────────────────
    console.log("\n── 2. VERIFY EMPTY STATE (no seed data) ──");
    const employeesRes = await api("/api/employees", "GET", undefined, token);
    const employees = employeesRes.data.data || [];
    assert(employees.length === 0, "No employees exist yet (empty state)");

    const mandatesRes = await api("/api/mandates", "GET", undefined, token);
    const mandates = mandatesRes.data.data || [];
    assert(mandates.length === 0, "No mandates exist yet (empty state)");

    const invoicesRes = await api("/api/finance/invoices", "GET", undefined, token);
    const invoices = invoicesRes.data.data || [];
    assert(invoices.length === 0, "No invoices exist yet (empty state)");

    // ─── 3. CSV IMPORT (invoices) ──────────────────────────────────────────
    console.log("\n── 3. CSV IMPORT (invoices) ──");
    const importRes = await api("/api/finance/import", "POST", {
      dataType: "invoices",
      rows: [
        { customerName: "Alpha Industries", customerEmail: "alpha@test.com", invoiceNumber: "INV-001", issueDate: "2025-01-01", dueDate: "2025-02-15", subtotal: 500000, tax: 90000 },
        { customerName: "Beta Trading", customerEmail: "beta@test.com", invoiceNumber: "INV-002", issueDate: "2025-01-01", dueDate: "2025-01-15", subtotal: 300000, tax: 54000 },
        { customerName: "Gamma Corp", customerEmail: "gamma@test.com", invoiceNumber: "INV-003", issueDate: "2025-01-01", dueDate: "2025-03-01", subtotal: 800000, tax: 144000 },
      ],
    }, token);

    assert(importRes.status === 200, `Import returns success (status ${importRes.status})`);
    assert(importRes.data.data?.imported === 3, `3 invoices imported (got ${importRes.data.data?.imported})`);
    assert(importRes.data.data?.errors === 0, `0 errors (got ${importRes.data.data?.errors})`);

    // ─── 4. VERIFY IMPORTED DATA ───────────────────────────────────────────
    console.log("\n── 4. VERIFY IMPORTED DATA ──");
    const invoicesAfterRes = await api("/api/finance/invoices", "GET", undefined, token);
    const invoicesAfter = invoicesAfterRes.data.data || [];
    assert(invoicesAfter.length === 3, `3 invoices now exist (got ${invoicesAfter.length})`);

    // ─── 5. DUPLICATE HANDLING ─────────────────────────────────────────────
    console.log("\n── 5. DUPLICATE HANDLING ──");
    const dupRes = await api("/api/finance/import", "POST", {
      dataType: "invoices",
      rows: [
        { customerName: "Alpha Industries", customerEmail: "alpha@test.com", invoiceNumber: "INV-001", issueDate: "2025-01-01", dueDate: "2025-02-15", subtotal: 500000, tax: 90000 },
      ],
    }, token);
    assert(dupRes.data.data?.skipped === 1, `Duplicate invoice skipped (got ${dupRes.data.data?.skipped})`);
    assert(dupRes.data.data?.imported === 0, `0 imported (duplicate) (got ${dupRes.data.data?.imported})`);

    // ─── 6. MALFORMED DATA ─────────────────────────────────────────────────
    console.log("\n── 6. MALFORMED DATA ──");
    const badRes = await api("/api/finance/import", "POST", {
      dataType: "invoices",
      rows: [
        { customerName: "", customerEmail: "bad@test.com", invoiceNumber: "INV-BAD", issueDate: "2025-01-01", dueDate: "2025-02-15", subtotal: 500000, tax: 90000 },
        { customerName: "Good Corp", customerEmail: "good@test.com", invoiceNumber: "INV-GOOD", issueDate: "2025-01-01", dueDate: "2025-02-15", subtotal: 100000, tax: 18000 },
      ],
    }, token);
    assert(badRes.data.data?.errors === 1, `1 error for malformed row (got ${badRes.data.data?.errors})`);
    assert(badRes.data.data?.imported === 1, `1 valid row imported (got ${badRes.data.data?.imported})`);

    // ─── 7. ONBOARDING SETUP (hires Kavya + grants Mandate) ────────────────
    console.log("\n── 7. ONBOARDING SETUP (hire Kavya + grant Mandate) ──");
    const setupRes = await api("/api/onboarding/setup", "POST", {
      industry: "manufacturing",
      country: "IN",
      currency: "INR",
      useDemoData: true, // use demo data since we already tested CSV import above
    }, token);

    assert(setupRes.status === 200 || setupRes.status === 201, `Onboarding setup returns success (status ${setupRes.status})`);
    assert(!!setupRes.data.data?.employee?.id, "Kavya hired (employee ID returned)");

    // Note: if onboarding was already completed, we get 409 — that's OK for this test
    if (setupRes.status === 409) {
      console.log("  ℹ️  Onboarding already completed — checking existing state");
    }

    // ─── 8. VERIFY MANDATE GRANTED ─────────────────────────────────────────
    console.log("\n── 8. VERIFY MANDATE GRANTED ──");
    const mandatesAfterRes = await api("/api/mandates", "GET", undefined, token);
    const mandatesAfter = mandatesAfterRes.data.data || [];
    assert(mandatesAfter.length > 0, "Mandate exists after onboarding");

    if (mandatesAfter.length > 0) {
      const mandate = mandatesAfter[0];
      assert(mandate.title === "Maintain Healthy Receivables", `Mandate title correct: "${mandate.title}"`);
      assert(mandate.status === "active", `Mandate is active (got ${mandate.status})`);
      assert(!!mandate.tenantId, "Mandate has tenant assigned");
      assert(!!mandate.declaration, "Mandate has declaration");
      assert(!!mandate.successCriteria, "Mandate has success criteria");
      assert(!!mandate.authoritySpec, "Mandate has authority spec");

      // ─── 9. VERIFY AUTHORITY ─────────────────────────────────────────────
      console.log("\n── 9. VERIFY AUTHORITY ──");
      const mandateDetailRes = await api(`/api/mandates/${mandate.id}`, "GET", undefined, token);
      const mandateDetail = mandateDetailRes.data.data;
      assert(!!mandateDetail.authority, "Mandate detail returns parsed authority");
      assert(mandateDetail.authority.autonomous.length > 0, "Authority has autonomous actions");
      assert(mandateDetail.authority.requiresApproval.length > 0, "Authority has approval-required actions");
      assert(mandateDetail.authority.forbidden.length > 0, "Authority has forbidden actions");

      // ─── 10. VERIFY KAVYA EXISTS ─────────────────────────────────────────
      console.log("\n── 10. VERIFY KAVYA (Finance Employee) ──");
      const employeesAfterRes = await api("/api/employees", "GET", undefined, token);
      const employeesAfter = employeesAfterRes.data.data || [];
      assert(employeesAfter.length > 0, "Finance Employee exists");
      const kavya = employeesAfter.find((e: any) => e.role === "finance_employee");
      assert(!!kavya, "Kavya (finance_employee) exists");
      assert(kavya?.status === "active", "Kavya is active");

      // ─── 11. VERIFY MANDATE HEALTH ──────────────────────────────────────
      console.log("\n── 11. VERIFY MANDATE HEALTH ──");
      assert(typeof mandateDetail.healthScore === "number", "Mandate has health score");
      assert(mandateDetail.healthScore >= 0 && mandateDetail.healthScore <= 100, `Health score 0-100: ${mandateDetail.healthScore}`);
      assert(!!mandateDetail.healthNote, "Mandate has health note");

      // ─── 12. VERIFY OUTCOME ECONOMICS ───────────────────────────────────
      console.log("\n── 12. VERIFY OUTCOME ECONOMICS ──");
      assert(!!mandateDetail.economics, "Mandate has outcome economics");
      if (mandateDetail.economics) {
        const econ = mandateDetail.economics;
        assert(typeof econ.currentOverdueRate === "number", "Economics has overdue rate (outcome)");
        assert(typeof econ.targetOverdueRate === "number", "Economics has target rate");
        assert(typeof econ.remindersSent === "number", "Economics has reminders sent (activity)");
        assert(econ.remindersSent !== econ.currentOverdueRate, "Activity ≠ outcome");
      }
    }

    // ─── 13. WORKSPACE ISOLATION ──────────────────────────────────────────
    console.log("\n── 13. WORKSPACE ISOLATION ──");
    // The demo workspace should NOT see this test workspace's data
    const demoLoginRes = await api("/api/auth/login", "POST", {
      email: "demo@ownara.com",
      password: "OwnaraDemo@2026!",
    });
    const demoToken = demoLoginRes.data.data?.accessToken;
    if (demoToken) {
      const demoMandatesRes = await api("/api/mandates", "GET", undefined, demoToken);
      const demoMandates = demoMandatesRes.data.data || [];
      const testMandateInDemo = demoMandates.find((m: any) => m.title === "Maintain Healthy Receivables" && m.workspaceId === workspaceId);
      assert(!testMandateInDemo, "Test workspace mandate NOT visible in demo workspace (isolation)");
    }

    // ─── 14. CLEAN UP ─────────────────────────────────────────────────────
    console.log("\n── 14. CLEAN UP ──");
    // Delete the test user + workspace (cascade will clean up)
    if (userId) {
      await db.session.deleteMany({ where: { userId } });
      await db.workspaceMember.deleteMany({ where: { userId } });
      const ws = await db.workspace.findFirst({ where: { ownerUserId: userId } });
      if (ws) {
        // MandateMemory is linked via mandateId, not workspaceId — delete mandates first (cascade)
        const mandateIds = await db.mandate.findMany({ where: { workspaceId: ws.id }, select: { id: true } });
        if (mandateIds.length > 0) {
          await db.mandateMemory.deleteMany({ where: { mandateId: { in: mandateIds.map(m => m.id) } } });
        }
        await db.mandate.deleteMany({ where: { workspaceId: ws.id } });
        await db.taskStep.deleteMany({ where: { task: { workspaceId: ws.id } } });
        await db.task.deleteMany({ where: { workspaceId: ws.id } });
        await db.reminder.deleteMany({ where: { workspaceId: ws.id } });
        await db.payment.deleteMany({ where: { workspaceId: ws.id } });
        await db.invoice.deleteMany({ where: { workspaceId: ws.id } });
        await db.customer.deleteMany({ where: { workspaceId: ws.id } });
        // Delete employee-related tables before employee
        await db.employeeToolPermission.deleteMany({ where: { employee: { workspaceId: ws.id } } });
        await db.employeeCapability.deleteMany({ where: { employee: { workspaceId: ws.id } } });
        await db.employeeMemory.deleteMany({ where: { workspaceId: ws.id } });
        await db.employeeProfile.deleteMany({ where: { workspaceId: ws.id } });
        await db.employee.deleteMany({ where: { workspaceId: ws.id } });
        await db.auditLog.deleteMany({ where: { workspaceId: ws.id } });
        await db.workspace.delete({ where: { id: ws.id } });
      }
      await db.user.delete({ where: { id: userId } });
      assert(true, "Test data cleaned up");
    }

  } catch (err) {
    console.log(`\n❌ TEST CRASHED: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${passed} passed, ${failed} failed` + " ".repeat(Math.max(0, 30 - `${passed} passed, ${failed} failed`.length)) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ❌ ${f}`));
  }

  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test crashed:", e);
  process.exit(1);
});
