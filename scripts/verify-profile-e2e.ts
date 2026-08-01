/**
 * BIHARI AI — Employee Profile Engine (EMP-001) End-to-End Verification
 *
 * This script exercises the FULL trust loop with profile updates:
 *   1. Login as Rohit (workspace owner)
 *   2. Snapshot Kavya's profile BEFORE
 *   3. Create a finance collections task
 *   4. Wait for the worker to plan, execute, and hit the approval gate
 *   5. Approve the pending approval
 *   6. Wait for the worker to complete the task
 *   7. Snapshot Kavya's profile AFTER
 *   8. Verify XP increased, trust changed, KPIs updated, skills grew
 *
 * Run with: bun run scripts/verify-profile-e2e.ts
 */

const API = "http://localhost:3000/api";
const EMAIL = "rohit@acmetrading.in";
const PASSWORD = "demo-password";

// Tiny fetch wrapper (JWT Bearer auth)
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
  console.log("EMP-001 End-to-End Verification");
  console.log("=".repeat(70));

  // ─── 1. Login ─────────────────────────────────────────────────────────────
  console.log("\n[1/8] Logging in as Rohit Sharma...");
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log("  ✓ Logged in. Token:", token.slice(0, 30) + "...");

  // ─── 2. Find Kavya ────────────────────────────────────────────────────────
  console.log("\n[2/8] Finding Kavya (Finance Employee)...");
  const employees = await jget("/employees", token);
  const kavya = employees.data.find((e: any) => e.role === "finance_employee");
  if (!kavya) throw new Error("Kavya not found");
  console.log("  ✓ Kavya ID:", kavya.id, "| Status:", kavya.status);

  // ─── 3. Snapshot profile BEFORE ──────────────────────────────────────────
  console.log("\n[3/8] Snapshotting profile BEFORE task...");
  const before = await jget(`/employees/${kavya.id}/profile`, token);
  console.log("  BEFORE:");
  console.log("    Level:", before.data.level, "| Title:", before.data.title, "| XP:", before.data.experiencePoints);
  console.log("    Trust:", before.data.trustScore, "| Risk:", before.data.riskScore, "| Approval rate:", before.data.approvalRate);
  console.log("    Tasks: completed=", before.data.completedTasks, "failed=", before.data.failedTasks, "automated=", before.data.tasksAutomated);
  console.log("    KPIs: emails=", before.data.emailsSent, "money=", before.data.moneyRecovered, "hoursSaved=", before.data.hoursSaved, "bizValue=", before.data.estimatedBusinessValue);
  console.log("    Memory: count=", before.data.memoryCount, "reinforcement=", before.data.reinforcementCount);
  console.log("    Capabilities: granted=", before.data.capabilitiesGranted, "critical=", before.data.criticalCapabilities);
  console.log("    Skills:", before.data.skills.map((s: any) => `${s.name}(L${s.level},u${s.usageCount})`).join(", ") || "(none)");
  console.log("    Version:", before.data.version);

  // ─── 4. Find overdue invoices to act on ───────────────────────────────────
  console.log("\n[4/8] Looking up overdue invoices...");
  const invoices = await jget("/finance/invoices", token);
  const overdue = invoices.data.filter((i: any) => i.status === "overdue");
  console.log("  ✓ Found", overdue.length, "overdue invoices");
  if (overdue.length === 0) throw new Error("No overdue invoices — seed data missing");

  // ─── 5. Check for an existing pending approval (from a prior run) ─────────
  // If one exists, reuse it instead of creating a new task. This makes the
  // script idempotent across re-runs.
  console.log("\n[5/8] Checking for existing pending approval...");
  const existingPending = await jget("/approvals/pending", token);
  let taskId: string;
  let approval: any = null;

  if (existingPending.data && existingPending.data.length > 0) {
    // Find one for Kavya (or any — Kavya is the only finance employee)
    approval = existingPending.data.find((a: any) => a.employeeId === kavya.id) || existingPending.data[0];
    taskId = approval.taskId;
    console.log("  ✓ Reusing existing pending approval:", approval.id, "for task:", taskId);
  } else {
    // ─── 5b. Create a finance collections task ──────────────────────────────
    console.log("\n[5/8] Creating a finance collections task for Kavya...");
    const taskRes = await jpost("/tasks", token, {
      title: "EMP-001 E2E: Collections follow-up for overdue invoices",
      description: `Process ${overdue.length} overdue invoices. Read each invoice, calculate aging, generate appropriate reminder, and send after human approval.`,
      employeeId: kavya.id,
      priority: "high",
      input: {
        invoiceIds: overdue.slice(0, 3).map((i: any) => i.id),
        action: "collections_follow_up",
      },
    });
    taskId = taskRes.data.id;
    console.log("  ✓ Task created:", taskId);

    // ─── 6. Wait for worker to reach approval gate ──────────────────────────
    console.log("\n[6/8] Waiting for worker to reach approval gate...");
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const pending = await jget("/approvals/pending", token);
      if (pending.data && pending.data.length > 0) {
        const found = pending.data.find((a: any) => a.taskId === taskId);
        if (found) {
          approval = found;
          break;
        }
      }
      if (i % 5 === 0) {
        const task = await jget(`/tasks/${taskId}`, token);
        console.log(`  ...tick ${i}: task status = ${task.data.status}, step = ${task.data.stepCount}`);
      }
    }
    if (!approval) {
      const task = await jget(`/tasks/${taskId}`, token);
      throw new Error(`No approval appeared. Final task status: ${task.data.status}`);
    }
    console.log("  ✓ Approval gate reached:", approval.id);
  }
  console.log("    Tool:", approval.toolDisplayName);
  console.log("    Employee profile (live):");
  console.log("      Level:", approval.profile?.level, approval.profile?.title);
  console.log("      Trust:", approval.profile?.trustScore, "| XP:", approval.profile?.experiencePoints);
  console.log("      Tasks completed:", approval.profile?.completedTasks, "| Approval rate:", approval.profile?.approvalRate);
  console.log("      Emails sent:", approval.profile?.emailsSent, "| Hours saved:", approval.profile?.hoursSaved);
  console.log("      Estimated business value: ₹", ((approval.profile?.estimatedBusinessValue ?? 0) / 100).toFixed(2));

  // ─── 7. Approve ──────────────────────────────────────────────────────────
  console.log("\n[7/8] Approving the action...");
  const approveRes = await jpost(`/approvals/${approval.id}/approve`, token, {
    reason: "EMP-001 E2E: Approved to verify profile updates",
  });
  console.log("  ✓ Approved:", approveRes.data.status);

  // ─── 8. Wait for task completion ──────────────────────────────────────────
  console.log("\n[8/8] Waiting for task completion...");
  let finalTask: any = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const task = await jget(`/tasks/${taskId}`, token);
    finalTask = task.data;
    if (task.data.status === "completed" || task.data.status === "failed") break;
    if (i % 5 === 0) console.log(`  ...tick ${i}: task status = ${task.data.status}`);
  }
  console.log("  ✓ Final task status:", finalTask.status);

  // ─── Snapshot profile AFTER ──────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("Profile Comparison");
  console.log("=".repeat(70));
  const after = await jget(`/employees/${kavya.id}/profile`, token);
  console.log("\nAFTER:");
  console.log("  Level:", after.data.level, "| Title:", after.data.title, "| XP:", after.data.experiencePoints);
  console.log("  Trust:", after.data.trustScore, "| Risk:", after.data.riskScore, "| Approval rate:", after.data.approvalRate);
  console.log("  Tasks: completed=", after.data.completedTasks, "failed=", after.data.failedTasks, "automated=", after.data.tasksAutomated);
  console.log("  KPIs: emails=", after.data.emailsSent, "money=", after.data.moneyRecovered, "hoursSaved=", after.data.hoursSaved, "bizValue=", after.data.estimatedBusinessValue);
  console.log("  Memory: count=", after.data.memoryCount, "reinforcement=", after.data.reinforcementCount);
  console.log("  Capabilities: granted=", after.data.capabilitiesGranted, "critical=", after.data.criticalCapabilities);
  console.log("  Skills:", after.data.skills.map((s: any) => `${s.name}(L${s.level},u${s.usageCount})`).join(", "));
  console.log("  Version:", after.data.version);
  console.log("  Progress to next level:", after.data.progressToNextLevel, "%");

  // ─── Assertions ───────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("Verification Results");
  console.log("=".repeat(70));

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // XP increased
  const xpDelta = after.data.experiencePoints - before.data.experiencePoints;
  checks.push({
    name: "XP increased",
    pass: xpDelta > 0,
    detail: `XP: ${before.data.experiencePoints} → ${after.data.experiencePoints} (Δ=${xpDelta})`,
  });

  // Version incremented
  const versionDelta = after.data.version - before.data.version;
  checks.push({
    name: "Profile version incremented (multiple updates)",
    pass: versionDelta >= 3,
    detail: `Version: ${before.data.version} → ${after.data.version} (Δ=${versionDelta})`,
  });

  // Tasks completed increased
  const tasksDelta = after.data.completedTasks - before.data.completedTasks;
  checks.push({
    name: "Completed tasks counter incremented",
    pass: tasksDelta >= 1,
    detail: `completedTasks: ${before.data.completedTasks} → ${after.data.completedTasks} (Δ=${tasksDelta})`,
  });

  // Tasks automated increased
  const autoDelta = after.data.tasksAutomated - before.data.tasksAutomated;
  checks.push({
    name: "Tasks automated KPI incremented",
    pass: autoDelta >= 1,
    detail: `tasksAutomated: ${before.data.tasksAutomated} → ${after.data.tasksAutomated} (Δ=${autoDelta})`,
  });

  // Hours saved increased
  const hoursDelta = after.data.hoursSaved - before.data.hoursSaved;
  checks.push({
    name: "Hours saved KPI incremented",
    pass: hoursDelta > 0,
    detail: `hoursSaved: ${before.data.hoursSaved} → ${after.data.hoursSaved} (Δ=${hoursDelta})`,
  });

  // Emails sent increased (only if the approved tool was a reminder)
  const emailsDelta = after.data.emailsSent - before.data.emailsSent;
  checks.push({
    name: "Emails sent KPI incremented (reminder approved)",
    pass: emailsDelta >= 1,
    detail: `emailsSent: ${before.data.emailsSent} → ${after.data.emailsSent} (Δ=${emailsDelta})`,
  });

  // Memory count increased (or reinforced)
  const memDelta = after.data.memoryCount - before.data.memoryCount;
  const reinDelta = after.data.reinforcementCount - before.data.reinforcementCount;
  checks.push({
    name: "Memory system updated (new or reinforced)",
    pass: memDelta > 0 || reinDelta > 0,
    detail: `memoryCount: ${before.data.memoryCount} → ${after.data.memoryCount} (Δ=${memDelta}); reinforcement: ${before.data.reinforcementCount} → ${after.data.reinforcementCount} (Δ=${reinDelta})`,
  });

  // Capabilities granted is non-zero (was a bug before)
  checks.push({
    name: "Capabilities granted count is non-zero (regression check)",
    pass: after.data.capabilitiesGranted > 0,
    detail: `capabilitiesGranted: ${before.data.capabilitiesGranted} → ${after.data.capabilitiesGranted}; critical: ${before.data.criticalCapabilities} → ${after.data.criticalCapabilities}`,
  });

  // Skills grew (usage count increased or new skill added)
  const beforeSkillTotal = before.data.skills.reduce((s: number, sk: any) => s + sk.usageCount, 0);
  const afterSkillTotal = after.data.skills.reduce((s: number, sk: any) => s + sk.usageCount, 0);
  const newSkills = after.data.skills.filter((s: any) => !before.data.skills.some((b: any) => b.name === s.name)).length;
  checks.push({
    name: "Skills grew (usage increased or new added)",
    pass: afterSkillTotal > beforeSkillTotal || newSkills > 0,
    detail: `total skill usages: ${beforeSkillTotal} → ${afterSkillTotal}; new skills added: ${newSkills}`,
  });

  // Trust score is still in valid range
  checks.push({
    name: "Trust score is in valid range [0, 100]",
    pass: after.data.trustScore >= 0 && after.data.trustScore <= 100,
    detail: `trustScore: ${after.data.trustScore}`,
  });

  // Level is at least 1 and at most 7
  checks.push({
    name: "Level is in valid range [1, 7]",
    pass: after.data.level >= 1 && after.data.level <= 7,
    detail: `level: ${after.data.level} (${after.data.title})`,
  });

  // Approval rate is in valid range [0, 1]
  checks.push({
    name: "Approval rate is in valid range [0, 1]",
    pass: after.data.approvalRate >= 0 && after.data.approvalRate <= 1,
    detail: `approvalRate: ${after.data.approvalRate}`,
  });

  // lastTaskAt is set
  checks.push({
    name: "lastTaskAt is set after task completion",
    pass: !!after.data.lastTaskAt,
    detail: `lastTaskAt: ${after.data.lastTaskAt}`,
  });

  // ─── Print results ────────────────────────────────────────────────────────
  let pass = 0;
  let fail = 0;
  for (const c of checks) {
    const icon = c.pass ? "✓" : "✗";
    console.log(`  ${icon} ${c.name}`);
    console.log(`     ${c.detail}`);
    if (c.pass) pass++;
    else fail++;
  }
  console.log("\n" + "=".repeat(70));
  console.log(`Result: ${pass} passed, ${fail} failed (of ${checks.length} checks)`);
  console.log("=".repeat(70));

  if (fail > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
