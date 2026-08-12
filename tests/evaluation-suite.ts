/**
 * BIHARI AI — Mandate Evaluation Suite
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
  console.log("║  BIHARI AI — Mandate Evaluation Suite (10 Scenarios)    ║");
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
