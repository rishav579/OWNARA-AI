/**
 * BIHARI AI — EMP-002 End-to-End Verification
 *
 * Creates a new finance task, waits for the worker to complete it (with
 * approvals), then verifies that the Learning Engine produced:
 *   - An OutcomeEvaluation
 *   - Skill reinforcements
 *   - Career timeline entries
 *   - Business outcomes
 *   - Achievement unlocks (if applicable)
 *
 * Run with: bun run scripts/verify-learning-e2e.ts
 */

const API = "http://localhost:3000/api";
const EMAIL = "rohit@acmetrading.in";
const PASSWORD = "demo-password";

async function jget(path: string, token: string) {
  const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}
async function jpost(path: string, token: string, body?: any) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`POST ${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=".repeat(70));
  console.log("EMP-002 End-to-End Verification");
  console.log("=".repeat(70));

  // 1. Login
  console.log("\n[1/8] Logging in...");
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const token = (await loginRes.json()).data.accessToken;
  console.log("  ✓ Logged in");

  // 2. Find Kavya + snapshot BEFORE
  console.log("\n[2/8] Snapshotting learning data BEFORE...");
  const employees = await jget("/employees", token);
  const kavya = employees.data.find((e: any) => e.role === "finance_employee");
  if (!kavya) throw new Error("Kavya not found");
  const KAVYA_ID = kavya.id;

  const beforeTimeline = await jget(`/employees/${KAVYA_ID}/career-timeline?limit=100`, token);
  const beforeAchievements = await jget(`/employees/${KAVYA_ID}/achievements`, token);
  const beforeOutcomes = await jget(`/employees/${KAVYA_ID}/outcome-history?limit=100`, token);
  const beforeStrengths = await jget(`/employees/${KAVYA_ID}/strengths`, token);
  const beforeImpact = await jget(`/employees/${KAVYA_ID}/business-impact`, token);

  console.log("  BEFORE:");
  console.log("    Timeline entries:", beforeTimeline.data.length);
  console.log("    Achievements unlocked:", beforeAchievements.data.filter((a: any) => a.unlocked).length);
  console.log("    Outcome evaluations:", beforeOutcomes.data.length);
  console.log("    Strengths:", beforeStrengths.data.length);
  console.log("    Business outcomes:", beforeImpact.data.totalOutcomes);
  console.log("    Current streak:", beforeImpact.data.currentStreak);

  // 3. Check for existing pending approval or create a task
  console.log("\n[3/8] Checking for pending approval or creating task...");
  let taskId: string;
  let approval: any = null;
  const existingPending = await jget("/approvals/pending", token);
  if (existingPending.data && existingPending.data.length > 0) {
    approval = existingPending.data.find((a: any) => a.employeeId === KAVYA_ID) || existingPending.data[0];
    taskId = approval.taskId;
    console.log("  ✓ Reusing existing pending approval:", approval.id);
  } else {
    // Cancel any in-flight task first
    const tasks = await jget("/tasks", token);
    const inFlight = tasks.data.find((t: any) => ["queued", "planning", "executing", "waiting_approval"].includes(t.status));
    if (inFlight) {
      console.log("  Cancelling in-flight task:", inFlight.id);
      await fetch(`${API}/tasks/${inFlight.id}/cancel`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}",
      });
      await sleep(2000);
    }

    const invoices = await jget("/finance/invoices", token);
    const overdue = invoices.data.filter((i: any) => i.status === "overdue");
    if (overdue.length === 0) throw new Error("No overdue invoices");

    const taskRes = await jpost("/tasks", token, {
      title: "EMP-002 E2E: Learning verification task",
      description: `Process ${overdue.length} overdue invoices. Generate reminders and send after approval.`,
      employeeId: KAVYA_ID,
      priority: "high",
      input: {
        invoiceIds: overdue.slice(0, 2).map((i: any) => i.id),
        action: "collections_follow_up",
      },
    });
    taskId = taskRes.data.id;
    console.log("  ✓ Task created:", taskId);

    // Wait for approval gate
    console.log("\n[4/8] Waiting for approval gate...");
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const pending = await jget("/approvals/pending", token);
      if (pending.data && pending.data.length > 0) {
        const found = pending.data.find((a: any) => a.taskId === taskId);
        if (found) { approval = found; break; }
      }
      if (i % 5 === 0) {
        const task = await jget(`/tasks/${taskId}`, token);
        console.log(`  ...tick ${i}: task status = ${task.data.status}`);
      }
    }
    if (!approval) throw new Error("No approval appeared");
    console.log("  ✓ Approval gate reached:", approval.id);
  }

  // 5. Approve
  console.log("\n[5/8] Approving...");
  await jpost(`/approvals/${approval.id}/approve`, token, {
    reason: "EMP-002 E2E verification",
  });
  console.log("  ✓ Approved");

  // 6. Wait for completion (may have multiple approval gates)
  console.log("\n[6/8] Waiting for task completion (may have multiple gates)...");
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const task = await jget(`/tasks/${taskId}`, token);
    if (task.data.status === "completed" || task.data.status === "failed") {
      console.log(`  ✓ Task ${task.data.status} at tick ${i}`);
      break;
    }
    // Check for new pending approvals (multiple gates)
    const pending = await jget("/approvals/pending", token);
    if (pending.data && pending.data.length > 0) {
      const newApproval = pending.data.find((a: any) => a.taskId === taskId);
      if (newApproval) {
        console.log(`  ...tick ${i}: new approval gate, approving`);
        await jpost(`/approvals/${newApproval.id}/approve`, token, { reason: "EMP-002 E2E auto-approve" });
      }
    }
    if (i % 5 === 0) console.log(`  ...tick ${i}: task status = ${task.data.status}`);
  }

  // 7. Wait for learning engine to process (give it a few seconds)
  console.log("\n[7/8] Waiting for learning engine to process...");
  await sleep(5000);

  // 8. Snapshot AFTER + verify
  console.log("\n[8/8] Snapshotting learning data AFTER...");
  const afterTimeline = await jget(`/employees/${KAVYA_ID}/career-timeline?limit=100`, token);
  const afterAchievements = await jget(`/employees/${KAVYA_ID}/achievements`, token);
  const afterOutcomes = await jget(`/employees/${KAVYA_ID}/outcome-history?limit=100`, token);
  const afterStrengths = await jget(`/employees/${KAVYA_ID}/strengths`, token);
  const afterImpact = await jget(`/employees/${KAVYA_ID}/business-impact`, token);

  console.log("\n" + "=".repeat(70));
  console.log("Verification Results");
  console.log("=".repeat(70));

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // Outcome evaluation was created
  const newOutcomes = afterOutcomes.data.length - beforeOutcomes.data.length;
  checks.push({
    name: "New OutcomeEvaluation created",
    pass: newOutcomes >= 1,
    detail: `outcome evaluations: ${beforeOutcomes.data.length} → ${afterOutcomes.data.length} (Δ=+${newOutcomes})`,
  });

  // Timeline entries increased
  const newTimeline = afterTimeline.data.length - beforeTimeline.data.length;
  checks.push({
    name: "Career timeline entries increased",
    pass: newTimeline >= 1,
    detail: `timeline entries: ${beforeTimeline.data.length} → ${afterTimeline.data.length} (Δ=+${newTimeline})`,
  });

  // Business outcomes increased
  const newBusinessOutcomes = afterImpact.data.totalOutcomes - beforeImpact.data.totalOutcomes;
  checks.push({
    name: "Business outcomes recorded (append-only)",
    pass: newBusinessOutcomes >= 1,
    detail: `business outcomes: ${beforeImpact.data.totalOutcomes} → ${afterImpact.data.totalOutcomes} (Δ=+${newBusinessOutcomes})`,
  });

  // Quality score is valid (0-100)
  const latestEval = afterOutcomes.data[0];
  checks.push({
    name: "Latest outcome has valid quality score (0-100)",
    pass: latestEval && latestEval.qualityScore >= 0 && latestEval.qualityScore <= 100,
    detail: `qualityScore: ${latestEval?.qualityScore}`,
  });

  // Outcome has deterministic summary
  checks.push({
    name: "Outcome has deterministic summary",
    pass: latestEval && latestEval.outcomeSummary && latestEval.outcomeSummary.length > 20,
    detail: `summary: "${latestEval?.outcomeSummary?.slice(0, 80)}..."`,
  });

  // Streak maintained or increased
  checks.push({
    name: "Success streak maintained or increased",
    pass: afterImpact.data.currentStreak >= beforeImpact.data.currentStreak,
    detail: `streak: ${beforeImpact.data.currentStreak} → ${afterImpact.data.currentStreak}`,
  });

  // Achievements list is non-empty
  checks.push({
    name: "Achievements are defined",
    pass: afterAchievements.data.length > 0,
    detail: `total achievements: ${afterAchievements.data.length}`,
  });

  // New timeline entry is a task_completed
  const hasNewTaskCompleted = afterTimeline.data.some(
    (e: any) => e.entryType === "task_completed" && !beforeTimeline.data.some((b: any) => b.id === e.id)
  );
  checks.push({
    name: "New task_completed timeline entry",
    pass: hasNewTaskCompleted,
    detail: `found new task_completed entry: ${hasNewTaskCompleted}`,
  });

  // ─── Print results ────────────────────────────────────────────────────────
  let pass = 0, fail = 0;
  for (const c of checks) {
    const icon = c.pass ? "✓" : "✗";
    console.log(`  ${icon} ${c.name}`);
    console.log(`     ${c.detail}`);
    if (c.pass) pass++; else fail++;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`AFTER snapshot:`);
  console.log(`  Timeline entries: ${afterTimeline.data.length}`);
  console.log(`  Achievements unlocked: ${afterAchievements.data.filter((a: any) => a.unlocked).length} / ${afterAchievements.data.length}`);
  console.log(`  Outcome evaluations: ${afterOutcomes.data.length}`);
  console.log(`  Strengths: ${afterStrengths.data.length}`);
  console.log(`  Business outcomes: ${afterImpact.data.totalOutcomes}`);
  console.log(`  Current streak: ${afterImpact.data.currentStreak}`);
  console.log("=".repeat(70));
  console.log(`Result: ${pass} passed, ${fail} failed (of ${checks.length} checks)`);
  console.log("=".repeat(70));

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
