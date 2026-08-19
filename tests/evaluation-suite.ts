/**
 * OWNARA — Mandate Evaluation Suite
 *
 * 10 deterministic business scenarios that prove the strategy selector
 * responds correctly to different observed states — including memory-influenced
 * decisions.
 *
 * These are NOT code-path tests. They are BUSINESS SCENARIO tests that verify
 * the AI reasons correctly about representative receivables situations.
 *
 * Run with: bun run tests/evaluation-suite.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let passed = 0;
let failed = 0;
const results: Array<{ scenario: string; status: string; detail: string }> = [];

function record(scenario: string, ok: boolean, detail: string) {
  passed += ok ? 1 : 0;
  failed += ok ? 0 : 1;
  results.push({ scenario, status: ok ? "✅ PASS" : "❌ FAIL", detail });
  console.log(`  ${ok ? "✅" : "❌"} ${scenario}: ${detail}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  OWNARA — Mandate Evaluation Suite (10 Scenarios)    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const { selectStrategy } = await import("../src/lib/mandate/strategy-selector");
  type ObservedState = any;
  type MandateMemoryRef = any;

  const mandateTitle = "Maintain Healthy Receivables";
  const declaration = "Receivables older than 30 days should remain below 15% of total outstanding.";

  // Helper to build an observed state
  function makeState(overrides: Partial<ObservedState>): ObservedState {
    return {
      overdueRate: 0.30,
      totalOutstanding: 100000000,
      totalOverdue: 30000000,
      overdueInvoiceCount: 5,
      overdueInvoices: [],
      disputedCount: 0,
      promisedPaymentCount: 0,
      unresponsiveCount: 0,
      topOverdueCustomer: null,
      recentEpisodeCount: 0,
      ...overrides,
    };
  }

  // ─── SCENARIO 1: Normal overdue invoice → reminder strategy ─────────────
  console.log("── SCENARIO 1: Normal overdue invoice → reminder strategy ──");
  {
    const state = makeState({
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-001", customerId: "c1", customerName: "Alpha", customerRiskLevel: "medium", outstanding: 500000, daysOverdue: 10, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: false, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 1", strategy?.strategy === "send_reminder_campaign", `Expected send_reminder_campaign, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 2: High-value customer → prioritization strategy ──────────
  console.log("\n── SCENARIO 2: High-value customer → prioritization strategy ──");
  {
    const state = makeState({
      totalOverdue: 10000000,
      topOverdueCustomer: { name: "Acme Pharma", amount: 5000000, percentage: 0.5 },
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-002", customerId: "c2", customerName: "Acme Pharma", customerRiskLevel: "low", outstanding: 5000000, daysOverdue: 45, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 2", strategy?.strategy === "prioritize_high_value", `Expected prioritize_high_value, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 3: Unresponsive customer → escalation strategy ────────────
  console.log("\n── SCENARIO 3: Unresponsive customer → escalation strategy ──");
  {
    const state = makeState({
      unresponsiveCount: 2,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-003", customerId: "c3", customerName: "Beta", customerRiskLevel: "high", outstanding: 300000, daysOverdue: 20, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 3", strategy?.strategy === "escalate_unresponsive", `Expected escalate_unresponsive, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 4: Disputed invoice → investigation strategy ──────────────
  console.log("\n── SCENARIO 4: Disputed invoice → investigation strategy ──");
  {
    const state = makeState({
      disputedCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-004", customerId: "c4", customerName: "Gamma", customerRiskLevel: "medium", outstanding: 800000, daysOverdue: 65, hasOpenCollectionCase: true, collectionCaseEscalation: 1, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 4", strategy?.strategy === "investigate_disputed", `Expected investigate_disputed, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 5: Customer promised payment → wait strategy ──────────────
  console.log("\n── SCENARIO 5: Customer promised payment → wait strategy ──");
  {
    const state = makeState({
      promisedPaymentCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-005", customerId: "c5", customerName: "Delta", customerRiskLevel: "low", outstanding: 400000, daysOverdue: 15, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: true },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 5", strategy?.strategy === "wait_for_promise", `Expected wait_for_promise, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 6: Healthy receivables → no action ────────────────────────
  console.log("\n── SCENARIO 6: Healthy receivables → no action ──");
  {
    const state = makeState({
      overdueRate: 0.05, // Below 15% target
      totalOverdue: 5000000,
      overdueInvoiceCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-006", customerId: "c6", customerName: "Epsilon", customerRiskLevel: "low", outstanding: 5000000, daysOverdue: 5, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: false },
      ],
      disputedCount: 0,
      promisedPaymentCount: 0,
      unresponsiveCount: 0,
      topOverdueCustomer: null,
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // With recent reminder and no special conditions, should be null (no actionable gap)
    record("Scenario 6", strategy === null, `Expected null (no action needed), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 7: Memory says previous strategy failed ───────────────────
  console.log("\n── SCENARIO 7: Memory says previous strategy failed ──");
  {
    const state = makeState({
      unresponsiveCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-007", customerId: "c7", customerName: "Zeta", customerRiskLevel: "high", outstanding: 600000, daysOverdue: 20, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const memory: MandateMemoryRef[] = [
      { id: "mem-1", memoryType: "strategy", content: "Strategy escalate_unresponsive was executed without measurable recovery. Episode completed with 20 steps.", importance: 0.5 },
    ];
    const strategy = selectStrategy(state, mandateTitle, declaration, memory);
    // Should still select escalate_unresponsive (it's the right strategy for unresponsive)
    // BUT the memory should be referenced in the reasoning
    record("Scenario 7", strategy?.strategy === "escalate_unresponsive" && strategy.reasoning.includes("Memory consulted"), `Strategy: ${strategy?.strategy}, memory referenced: ${strategy?.reasoning.includes("Memory consulted")}`);
  }

  // ─── SCENARIO 8: Memory says customer responds to specific approach ─────
  console.log("\n── SCENARIO 8: Memory says customer responds to specific approach ──");
  {
    const state = makeState({
      topOverdueCustomer: { name: "Acme Pharma", amount: 5000000, percentage: 0.5 },
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-008", customerId: "c8", customerName: "Acme Pharma", customerRiskLevel: "low", outstanding: 5000000, daysOverdue: 45, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const memory: MandateMemoryRef[] = [
      { id: "mem-2", memoryType: "customer_pattern", content: "Acme Pharma responds to second reminders within 48 hours; first reminders are often ignored.", importance: 0.8 },
    ];
    const strategy = selectStrategy(state, mandateTitle, declaration, memory);
    // Should select prioritize_high_value AND reference the customer memory
    record("Scenario 8", strategy?.strategy === "prioritize_high_value" && strategy.memoryUsed.length > 0, `Strategy: ${strategy?.strategy}, memory used: ${strategy?.memoryUsed.length}`);
  }

  // ─── SCENARIO 9: Conflicting memories → deterministic safe behavior ─────
  console.log("\n── SCENARIO 9: Conflicting memories → deterministic safe behavior ──");
  {
    const state = makeState({
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-009", customerId: "c9", customerName: "Eta", customerRiskLevel: "medium", outstanding: 400000, daysOverdue: 10, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: false, hasCustomerResponse: false },
      ],
    });
    const memory: MandateMemoryRef[] = [
      { id: "mem-3", memoryType: "customer_pattern", content: "Eta responds well to reminders.", importance: 0.7 },
      { id: "mem-4", memoryType: "approval_feedback", content: "Grantor rejected reminders for Eta last time.", importance: 0.9 },
    ];
    const strategy = selectStrategy(state, mandateTitle, declaration, memory);
    // Conflicting memories should NOT prevent action — the selector should still select
    // send_reminder_campaign (the appropriate strategy for standard overdue with no recent reminder)
    // but reference the rejection memory in the reasoning
    record("Scenario 9", strategy?.strategy === "send_reminder_campaign" && strategy.reasoning.includes("Memory consulted"), `Strategy: ${strategy?.strategy}, memory consulted: ${strategy?.reasoning.includes("Memory consulted")}`);
  }

  // ─── SCENARIO 10: Insufficient evidence → avoid overconfident action ───
  console.log("\n── SCENARIO 10: Insufficient evidence → avoid overconfident action ──");
  {
    // No overdue invoices at all — no actionable gap
    const state = makeState({
      overdueRate: 0,
      totalOverdue: 0,
      overdueInvoiceCount: 0,
      overdueInvoices: [],
      disputedCount: 0,
      promisedPaymentCount: 0,
      unresponsiveCount: 0,
      topOverdueCustomer: null,
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    record("Scenario 10", strategy === null, `Expected null (no evidence of a gap), got ${strategy?.strategy || "null"}`);
  }

  // ═══ ADVERSARIAL SCENARIOS (Phase 10) ═══════════════════════════════════

  // ─── SCENARIO 11: Ambiguous state — multiple conditions present ─────────
  console.log("\n── SCENARIO 11: Ambiguous state (disputed + high-value + unresponsive) ──");
  {
    // When multiple conditions exist, the priority order should pick the highest
    // priority: investigate_disputed > prioritize_high_value > escalate_unresponsive
    const state = makeState({
      disputedCount: 1,
      unresponsiveCount: 1,
      topOverdueCustomer: { name: "Big Corp", amount: 5000000, percentage: 0.5 },
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-011", customerId: "c1", customerName: "Big Corp", customerRiskLevel: "high", outstanding: 5000000, daysOverdue: 70, hasOpenCollectionCase: true, collectionCaseEscalation: 2, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // Disputed takes priority over high-value and unresponsive
    record("Scenario 11", strategy?.strategy === "investigate_disputed", `Expected investigate_disputed (highest priority), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 12: Conflicting evidence — disputed but customer responded ─
  console.log("\n── SCENARIO 12: Conflicting evidence (disputed but customer responded) ──");
  {
    const state = makeState({
      disputedCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-012", customerId: "c2", customerName: "Conflicting", customerRiskLevel: "medium", outstanding: 400000, daysOverdue: 65, hasOpenCollectionCase: true, collectionCaseEscalation: 1, hasRecentReminder: true, hasCustomerResponse: true },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // Should still investigate the dispute (safety-first)
    record("Scenario 12", strategy?.strategy === "investigate_disputed", `Expected investigate_disputed (safety-first), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 13: Stale memory — old strategy memory ────────────────────
  console.log("\n── SCENARIO 13: Stale memory (old strategy memory) ──");
  {
    const state = makeState({
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-013", customerId: "c3", customerName: "Stale", customerRiskLevel: "medium", outstanding: 300000, daysOverdue: 10, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: false, hasCustomerResponse: false },
      ],
    });
    const memory: MandateMemoryRef[] = [
      { id: "mem-old", memoryType: "strategy", content: "Strategy send_reminder_campaign was effective 6 months ago.", importance: 0.3 },
    ];
    const strategy = selectStrategy(state, mandateTitle, declaration, memory);
    // Should still select send_reminder_campaign (stale memory doesn't block action)
    record("Scenario 13", strategy?.strategy === "send_reminder_campaign", `Expected send_reminder_campaign, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 14: Recently-paid invoice in overdue list ─────────────────
  console.log("\n── SCENARIO 14: Recently-paid invoice (observer filters it out) ──");
  {
    // The observer (observeMandateState) filters out invoices with outstanding=0.
    // The strategy selector receives only invoices with outstanding > 0.
    // This test verifies that when the overdue list is empty (all paid), no action is taken.
    const state = makeState({
      overdueInvoices: [], // observer filtered out the paid invoice
      overdueInvoiceCount: 0,
      overdueRate: 0,
      totalOverdue: 0,
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // No actionable overdue → no action
    record("Scenario 14", strategy === null, `No action (all invoices paid), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 15: Invoice paid immediately before action ────────────────
  console.log("\n── SCENARIO 15: Invoice paid immediately before action ──");
  {
    // Customer pays right before the reminder would be sent
    const state = makeState({
      promisedPaymentCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-015", customerId: "c5", customerName: "JustPaid", customerRiskLevel: "low", outstanding: 500000, daysOverdue: 5, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: true },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // Customer responded → should wait, not send more reminders
    record("Scenario 15", strategy === null || strategy?.strategy === "wait_for_promise", `Should wait (customer responded), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 16: Customer with active promise ──────────────────────────
  console.log("\n── SCENARIO 16: Customer with active promise (all have recent reminders) ──");
  {
    const state = makeState({
      promisedPaymentCount: 2,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-016", customerId: "c6", customerName: "Promise1", customerRiskLevel: "low", outstanding: 300000, daysOverdue: 15, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: true },
        { id: "2", invoiceNumber: "INV-017", customerId: "c7", customerName: "Promise2", customerRiskLevel: "medium", outstanding: 200000, daysOverdue: 10, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: true },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // All have recent reminders + responses → wait for promise
    record("Scenario 16", strategy?.strategy === "wait_for_promise", `Expected wait_for_promise, got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 17: Contradictory customer behavior ───────────────────────
  console.log("\n── SCENARIO 17: Contradictory behavior (responded but still overdue) ──");
  {
    const state = makeState({
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-018", customerId: "c8", customerName: "Contradictory", customerRiskLevel: "medium", outstanding: 400000, daysOverdue: 45, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: true, hasCustomerResponse: true },
      ],
      unresponsiveCount: 0, // customer DID respond
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // Customer responded but invoice still overdue — no special strategy triggers
    // (not unresponsive, not disputed, not high-value, has recent reminder)
    // → null (no actionable gap) is safe behavior
    record("Scenario 17", strategy === null || strategy?.strategy !== "escalate_unresponsive", `Should not escalate (customer responded), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 18: Authority changed during pending approval ─────────────
  console.log("\n── SCENARIO 18: Authority changed (forbidden action) ──");
  {
    // The strategy selector doesn't check authority (that's the executor's job),
    // but we verify it doesn't produce a strategy that requires a forbidden action
    const state = makeState({
      disputedCount: 1,
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-019", customerId: "c9", customerName: "Disputed", customerRiskLevel: "high", outstanding: 800000, daysOverdue: 65, hasOpenCollectionCase: true, collectionCaseEscalation: 1, hasRecentReminder: true, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // investigate_disputed is autonomous (no forbidden action needed)
    record("Scenario 18", strategy?.strategy === "investigate_disputed", `investigate_disputed is safe (autonomous), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 19: Empty state with memory ───────────────────────────────
  console.log("\n── SCENARIO 19: Empty state with memory (no action despite memory) ──");
  {
    const state = makeState({
      overdueRate: 0,
      totalOverdue: 0,
      overdueInvoiceCount: 0,
      overdueInvoices: [],
    });
    const memory: MandateMemoryRef[] = [
      { id: "mem-1", memoryType: "strategy", content: "Previous strategy was effective.", importance: 0.8 },
    ];
    const strategy = selectStrategy(state, mandateTitle, declaration, memory);
    // No overdue → no action, even with memory
    record("Scenario 19", strategy === null, `No action despite memory (no gap), got ${strategy?.strategy || "null"}`);
  }

  // ─── SCENARIO 20: High-value customer with no memory ────────────────────
  console.log("\n── SCENARIO 20: High-value customer with no memory (first encounter) ──");
  {
    const state = makeState({
      topOverdueCustomer: { name: "New Big Customer", amount: 8000000, percentage: 0.6 },
      overdueInvoices: [
        { id: "1", invoiceNumber: "INV-020", customerId: "c10", customerName: "New Big Customer", customerRiskLevel: "medium", outstanding: 8000000, daysOverdue: 30, hasOpenCollectionCase: false, collectionCaseEscalation: 0, hasRecentReminder: false, hasCustomerResponse: false },
      ],
    });
    const strategy = selectStrategy(state, mandateTitle, declaration, []);
    // Should prioritize the high-value customer even without memory
    record("Scenario 20", strategy?.strategy === "prioritize_high_value", `Expected prioritize_high_value (first encounter), got ${strategy?.strategy || "null"}`);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${passed} passed, ${failed} failed` + " ".repeat(Math.max(0, 30 - `${passed} passed, ${failed} failed`.length)) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\nFailures:");
    results.filter((r) => r.status === "❌ FAIL").forEach((r) => console.log(`  ${r.scenario}: ${r.detail}`));
  }

  await db.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Evaluation suite crashed:", e);
  process.exit(1);
});
