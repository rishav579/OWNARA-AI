/**
 * BIHARI AI — EMP-001 Final Verification (assertion-only)
 *
 * Runs against the current database state. Confirms that the profile
 * engine has correctly updated Kavya's profile after the finance task
 * completed end-to-end (planning → executing → approval gate →
 * approved → continued → second approval gate → approved → completed).
 *
 * Run with: bun run scripts/verify-profile-final.ts
 */

import { db } from "../src/lib/db";

const BEFORE = {
  level: 2,
  title: "Junior Employee",
  experiencePoints: 103,
  completedTasks: 1,
  failedTasks: 0,
  tasksAutomated: 1,
  emailsSent: 8,
  customersHandled: 8,
  hoursSaved: 0.5,
  memoryCount: 21,
  reinforcementCount: 35,
  capabilitiesGranted: 10, // already backfilled
  criticalCapabilities: 2,
  version: 46,
  skillsTotalUsage: 30, // 3 skills × 10 usages each
  skillsMaxLevel: 3,
  accuracyScore: 0.91,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("=".repeat(70));
  console.log("EMP-001 Final Verification");
  console.log("=".repeat(70));

  const kavya = await db.employee.findFirst({ where: { name: "Kavya" } });
  if (!kavya) throw new Error("Kavya not found");

  const p = await db.employeeProfile.findUnique({ where: { employeeId: kavya.id } });
  if (!p) throw new Error("Profile not found");

  const skills: Array<{ name: string; level: number; usageCount: number; confidence: number }> = JSON.parse(p.skills);
  const skillsTotalUsage = skills.reduce((s, sk) => s + sk.usageCount, 0);
  const skillsMaxLevel = Math.max(...skills.map((s) => s.level), 0);

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // ─── Experience ─────────────────────────────────────────────────────────
  const xpDelta = p.experiencePoints - BEFORE.experiencePoints;
  checks.push({
    name: "XP increased (multiple events fired)",
    pass: xpDelta >= 50,
    detail: `XP: ${BEFORE.experiencePoints} → ${p.experiencePoints} (Δ=+${xpDelta})`,
  });

  checks.push({
    name: "Level increased (crossed level threshold)",
    pass: p.level > BEFORE.level,
    detail: `Level: ${BEFORE.level} → ${p.level} (${BEFORE.title} → ${p.title})`,
  });

  checks.push({
    name: "Title matches level (Junior → Employee)",
    pass: p.level === 3 && p.title === "Employee",
    detail: `Title: ${p.title} for level ${p.level}`,
  });

  checks.push({
    name: "Completed tasks counter incremented",
    pass: p.completedTasks > BEFORE.completedTasks,
    detail: `completedTasks: ${BEFORE.completedTasks} → ${p.completedTasks}`,
  });

  checks.push({
    name: "Tasks automated KPI incremented",
    pass: p.tasksAutomated > BEFORE.tasksAutomated,
    detail: `tasksAutomated: ${BEFORE.tasksAutomated} → ${p.tasksAutomated}`,
  });

  checks.push({
    name: "Approval rate is in valid range [0, 1]",
    pass: p.approvalRate >= 0 && p.approvalRate <= 1,
    detail: `approvalRate: ${p.approvalRate}`,
  });

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const emailsDelta = p.emailsSent - BEFORE.emailsSent;
  checks.push({
    name: "Emails sent KPI incremented (reminders approved)",
    pass: emailsDelta >= 2,
    detail: `emailsSent: ${BEFORE.emailsSent} → ${p.emailsSent} (Δ=+${emailsDelta})`,
  });

  const hoursDelta = p.hoursSaved - BEFORE.hoursSaved;
  checks.push({
    name: "Hours saved KPI incremented",
    pass: hoursDelta > 0,
    detail: `hoursSaved: ${BEFORE.hoursSaved} → ${p.hoursSaved} (Δ=+${hoursDelta})`,
  });

  // ─── Quality ───────────────────────────────────────────────────────────
  checks.push({
    name: "Trust score is in valid range [0, 100]",
    pass: p.trustScore >= 0 && p.trustScore <= 100,
    detail: `trustScore: ${p.trustScore}`,
  });

  checks.push({
    name: "Risk score is in valid range [0, 100]",
    pass: p.riskScore >= 0 && p.riskScore <= 100,
    detail: `riskScore: ${p.riskScore}`,
  });

  checks.push({
    name: "Accuracy score nudged by contract approvals",
    pass: p.accuracyScore >= BEFORE.accuracyScore,
    detail: `accuracyScore: ${BEFORE.accuracyScore} → ${p.accuracyScore}`,
  });

  // ─── Learning / Skills ────────────────────────────────────────────────
  const skillsUsageDelta = skillsTotalUsage - BEFORE.skillsTotalUsage;
  checks.push({
    name: "Skill usage counts grew",
    pass: skillsUsageDelta > 0,
    detail: `total skill usages: ${BEFORE.skillsTotalUsage} → ${skillsTotalUsage} (Δ=+${skillsUsageDelta})`,
  });

  checks.push({
    name: "Skill levels grew (L3 → L4+)",
    pass: skillsMaxLevel > BEFORE.skillsMaxLevel,
    detail: `max skill level: ${BEFORE.skillsMaxLevel} → ${skillsMaxLevel}`,
  });

  checks.push({
    name: "At least 3 distinct skills tracked",
    pass: skills.length >= 3,
    detail: `skills: ${skills.map((s) => s.name).join(", ")}`,
  });

  // ─── Memory ────────────────────────────────────────────────────────────
  const memDelta = p.memoryCount - BEFORE.memoryCount;
  checks.push({
    name: "Memory count increased",
    pass: memDelta > 0,
    detail: `memoryCount: ${BEFORE.memoryCount} → ${p.memoryCount} (Δ=+${memDelta})`,
  });

  const reinDelta = p.reinforcementCount - BEFORE.reinforcementCount;
  checks.push({
    name: "Reinforcement count increased (memories reinforced)",
    pass: reinDelta > 0,
    detail: `reinforcementCount: ${BEFORE.reinforcementCount} → ${p.reinforcementCount} (Δ=+${reinDelta})`,
  });

  // ─── Capabilities (regression check for count+include bug) ────────────
  checks.push({
    name: "Capabilities granted count is non-zero (bug fix regression check)",
    pass: p.capabilitiesGranted === 10,
    detail: `capabilitiesGranted: ${BEFORE.capabilitiesGranted} → ${p.capabilitiesGranted} (expected 10)`,
  });

  checks.push({
    name: "Critical capabilities count is correct (2 high-risk)",
    pass: p.criticalCapabilities === 2,
    detail: `criticalCapabilities: ${BEFORE.criticalCapabilities} → ${p.criticalCapabilities} (expected 2)`,
  });

  // ─── Version / Timeline ────────────────────────────────────────────────
  const versionDelta = p.version - BEFORE.version;
  checks.push({
    name: "Profile version incremented many times (event-driven updates)",
    pass: versionDelta >= 20,
    detail: `version: ${BEFORE.version} → ${p.version} (Δ=+${versionDelta})`,
  });

  checks.push({
    name: "lastTaskAt is set after task completion",
    pass: !!p.lastTaskAt,
    detail: `lastTaskAt: ${p.lastTaskAt}`,
  });

  checks.push({
    name: "updatedAt is recent (within last 10 min)",
    pass: Date.now() - p.updatedAt.getTime() < 10 * 60 * 1000,
    detail: `updatedAt: ${p.updatedAt}`,
  });

  // ─── Print results ─────────────────────────────────────────────────────
  let pass = 0, fail = 0;
  for (const c of checks) {
    const icon = c.pass ? "✓" : "✗";
    console.log(`  ${icon} ${c.name}`);
    console.log(`     ${c.detail}`);
    if (c.pass) pass++; else fail++;
  }
  console.log("\n" + "=".repeat(70));
  console.log(`Result: ${pass} passed, ${fail} failed (of ${checks.length} checks)`);
  console.log("=".repeat(70));

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
