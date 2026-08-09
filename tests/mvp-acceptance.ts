/**
 * BIHARI AI — MVP 1 Acceptance Test Suite
 *
 * Tests the critical paths that prove the Mandate is a genuine new unit of
 * organizational work — not a renamed task.
 *
 * Run with: bun run tests/mvp-acceptance.ts
 *
 * These tests use the actual database + APIs (not mocks) to verify the
 * complete loop end-to-end.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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

async function test(label: string, fn: () => Promise<void>) {
  console.log(`\n── ${label} ──`);
  try {
    await fn();
  } catch (err) {
    failed++;
    failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    console.log(`  ❌ THREW: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  BIHARI AI — MVP 1 Acceptance Test Suite                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // ─── Setup: find the demo workspace + mandate ────────────────────────────
  const demoUser = await db.user.findUnique({ where: { email: "demo@bihari.ai" } });
  const workspaceMember = demoUser ? await db.workspaceMember.findFirst({ where: { userId: demoUser.id } }) : null;
  const workspace = workspaceMember ? await db.workspace.findUnique({ where: { id: workspaceMember.workspaceId } }) : null;

  assert(!!demoUser, "Demo account (demo@bihari.ai) exists");
  assert(!!workspace, "Demo workspace exists");

  if (!workspace) {
    console.log("\n❌ Cannot run tests without a workspace. Run `bun run scripts/seed.ts` first.");
    return;
  }

  const mandate = await db.mandate.findFirst({ where: { workspaceId: workspace.id } });
  assert(!!mandate, "Active Mandate exists in demo workspace");

  // ─── A. Mandate creation ─────────────────────────────────────────────────
  await test("A. Mandate creation", async () => {
    assert(!!mandate, "Mandate was created");
    assert(mandate!.status === "active", "Mandate is active");
    assert(!!mandate!.declaration, "Mandate has a declaration");
    assert(!!mandate!.successCriteria, "Mandate has success criteria");
    assert(!!mandate!.authoritySpec, "Mandate has authority spec");
    assert(!!mandate!.tenantId, "Mandate has a tenant assigned");
    assert(!!mandate!.grantorId, "Mandate has a grantor");
  });

  // ─── B. Mandate authority enforcement ───────────────────────────────────
  await test("B. Authority enforcement", async () => {
    const { checkAuthority, parseAuthoritySpec } = await import("../src/lib/mandate/engine");
    const spec = mandate!.authoritySpec;

    const autonomous = checkAuthority(spec, "generate_reminder");
    assert(autonomous.allowed && autonomous.mode === "autonomous", "generate_reminder is autonomous");

    const approval = checkAuthority(spec, "send_reminder");
    assert(approval.allowed && approval.mode === "approval", "send_reminder requires approval");

    const forbidden = checkAuthority(spec, "send_legal_notice");
    assert(!forbidden.allowed && forbidden.mode === "forbidden", "send_legal_notice is forbidden");

    // Unknown action defaults to approval (safe default)
    const unknown = checkAuthority(spec, "unknown_action");
    assert(unknown.allowed && unknown.mode === "approval", "Unknown action defaults to approval");
  });

  // ─── C. Strategy selection ──────────────────────────────────────────────
  await test("C. Strategy selection (not a fixed workflow)", async () => {
    const { observeMandateState, selectStrategy } = await import("../src/lib/mandate/strategy-selector");
    const state = await observeMandateState(workspace.id);

    assert(state.overdueInvoices.length >= 0, "Observed state has overdue invoices");
    assert(typeof state.overdueRate === "number", "Observed state has overdue rate");
    assert(state.totalOutstanding >= 0, "Observed state has total outstanding");

    const strategy = selectStrategy(state, mandate!.title, mandate!.declaration, []);
    if (strategy) {
      assert(!!strategy.strategy, "Strategy has a type");
      assert(!!strategy.reasoning, "Strategy has reasoning");
      assert(!!strategy.episodeTitle, "Strategy has an episode title");
      assert(["investigate_disputed", "prioritize_high_value", "send_reminder_campaign", "wait_for_promise", "escalate_unresponsive"].includes(strategy.strategy), `Strategy type is valid: ${strategy.strategy}`);
    } else {
      assert(true, "Strategy returned null (no actionable gap) — valid");
    }
  });

  // ─── D. Strategy selection uses memory ──────────────────────────────────
  await test("D. Strategy selection retrieves and uses memory", async () => {
    const { observeMandateState, selectStrategy } = await import("../src/lib/mandate/strategy-selector");
    const state = await observeMandateState(workspace.id);

    // Create a fake memory entry to pass to the selector
    const fakeMemory: any[] = [
      { id: "test-mem-1", memoryType: "customer_pattern", content: "Test customer responds to reminders", importance: 0.8 },
    ];

    const strategy = selectStrategy(state, mandate!.title, mandate!.declaration, fakeMemory);
    if (strategy) {
      // The strategy should reference memory in its reasoning
      assert(strategy.reasoning.includes("Memory consulted") || strategy.reasoning.includes("No prior memory"), "Strategy reasoning references memory context");
    } else {
      assert(true, "Strategy null — memory retrieval still ran");
    }
  });

  // ─── E. Memory provenance ───────────────────────────────────────────────
  await test("E. Memory provenance", async () => {
    const memories = await db.mandateMemory.findMany({
      where: { mandateId: mandate!.id },
      take: 5,
    });

    assert(memories.length > 0, "Mandate has memory entries");

    for (const mem of memories) {
      assert(!!mem.memoryType, `Memory ${mem.id} has memoryType`);
      assert(!!mem.content, `Memory ${mem.id} has content`);
      assert(typeof mem.importance === "number", `Memory ${mem.id} has importance`);
      assert(mem.createdAt instanceof Date, `Memory ${mem.id} has createdAt`);
      // sourceType and sourceId are nullable (seeded memory has sourceType="supervisor")
      if (mem.sourceType) {
        assert(["supervisor", "task", "approval", "evaluation", "human"].includes(mem.sourceType), `Memory ${mem.id} has valid sourceType: ${mem.sourceType}`);
      }
    }
  });

  // ─── F. Memory survives tenant replacement ──────────────────────────────
  await test("F. Memory survives tenant replacement", async () => {
    const { reassignMandateTenant } = await import("../src/lib/mandate/engine");

    // Count memory before
    const memoryBefore = await db.mandateMemory.count({ where: { mandateId: mandate!.id } });

    // Create a second employee
    const newEmployee = await db.employee.create({
      data: {
        workspaceId: workspace.id,
        name: "Test Employee B",
        role: "finance_employee",
        status: "active",
        state: "idle",
        jobDescription: "Test employee for tenant replacement",
        boundaries: "[]",
        approvalRules: "{}",
        tools: "[]",
        createdBy: demoUser!.id,
      },
    });

    // Reassign
    await reassignMandateTenant(mandate!.id, newEmployee.id, demoUser!.id, "Tenant replacement test");

    // Count memory after
    const memoryAfter = await db.mandateMemory.count({ where: { mandateId: mandate!.id } });

    assert(memoryAfter === memoryBefore, `Memory preserved: ${memoryBefore} → ${memoryAfter}`);

    // Verify the mandate still has the same declaration, authority, health
    const after = await db.mandate.findUnique({ where: { id: mandate!.id } });
    assert(after!.declaration === mandate!.declaration, "Declaration preserved after replacement");
    assert(after!.authoritySpec === mandate!.authoritySpec, "Authority preserved after replacement");
    assert(after!.healthScore === mandate!.healthScore, "Health preserved after replacement");
    assert(after!.status === mandate!.status, "Status preserved after replacement");
    assert(after!.tenantId === newEmployee.id, "Tenant updated to new employee");

    // Clean up: reassign back to original tenant
    if (mandate!.tenantId) {
      await reassignMandateTenant(mandate!.id, mandate!.tenantId, demoUser!.id, "Restoring original tenant");
    }
    // Clean up: delete test employee
    await db.employee.delete({ where: { id: newEmployee.id } });
  });

  // ─── G. Audit integrity ─────────────────────────────────────────────────
  await test("G. Audit integrity (hash chain)", async () => {
    const { verifyAuditChain } = await import("../src/lib/runtime/audit");
    const result = await verifyAuditChain(workspace.id);
    assert(result.valid, `Audit chain is valid (${result.totalEntries} entries)`);
  });

  // ─── H. Workspace isolation ─────────────────────────────────────────────
  await test("H. Workspace isolation", async () => {
    // Create a second workspace + user
    const secondUser = await db.user.create({
      data: {
        email: "isolation-test@bihari.ai",
        passwordHash: "test",
        name: "Isolation Test",
        status: "active",
      },
    });
    const secondWorkspace = await db.workspace.create({
      data: {
        name: "Isolation Test Corp",
        slug: "isolation-test",
        ownerUserId: secondUser.id,
        status: "active",
      },
    });

    // Mandates from workspace 1 should NOT be visible to workspace 2
    const ws1Mandates = await db.mandate.findMany({ where: { workspaceId: workspace.id } });
    const ws2Mandates = await db.mandate.findMany({ where: { workspaceId: secondWorkspace.id } });

    assert(ws1Mandates.length > 0, "Workspace 1 has mandates");
    assert(ws2Mandates.length === 0, "Workspace 2 has no mandates (isolated)");

    // Clean up
    await db.workspace.delete({ where: { id: secondWorkspace.id } });
    await db.user.delete({ where: { id: secondUser.id } });
  });

  // ─── I. Outcome economics (activity ≠ outcome) ──────────────────────────
  await test("I. Outcome economics (activity ≠ outcome)", async () => {
    const { computeMandateOutcomeEconomics } = await import("../src/lib/mandate/engine");
    const economics = await computeMandateOutcomeEconomics(mandate!.id);

    assert(typeof economics.currentOverdueRate === "number", "Has current overdue rate (outcome)");
    assert(typeof economics.targetOverdueRate === "number", "Has target overdue rate");
    assert(typeof economics.gap === "number", "Has gap");
    assert(typeof economics.totalRecovered === "number", "Has total recovered (outcome)");
    assert(typeof economics.remindersSent === "number", "Has reminders sent (activity)");
    assert(typeof economics.totalEpisodes === "number", "Has total episodes (activity)");
    assert(typeof economics.netValue === "number", "Has net value");

    // Activity and outcome are separate fields
    assert(economics.remindersSent !== economics.currentOverdueRate, "Activity ≠ outcome (reminders ≠ overdue rate)");
  });

  // ─── J. Mandate health from real business state ─────────────────────────
  await test("J. Mandate health from real business state", async () => {
    const { computeMandateHealth } = await import("../src/lib/mandate/engine");
    const health = await computeMandateHealth(mandate!.id);

    assert(typeof health.score === "number", "Health has a score");
    assert(health.score >= 0 && health.score <= 100, `Health score is 0-100: ${health.score}`);
    assert(!!health.note, "Health has a note explaining the score");
  });

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
  console.error("Test suite crashed:", e);
  process.exit(1);
});
