/**
 * BIHARI AI — Backfill script for the Autonomous Learning Engine (EMP-002)
 *
 * Processes all existing completed tasks that don't have an OutcomeEvaluation
 * yet. For each, runs the full learning pipeline:
 *   evaluate → reinforce → patterns → weaknesses → strengths → outcomes → timeline → achievements
 *
 * Usage: bun run scripts/backfill-learning.ts
 */

import { db } from "../src/lib/db";
import { evaluateAndLearn } from "../src/lib/learning/engine";

async function main() {
  console.log("=".repeat(70));
  console.log("EMP-002 Backfill — Processing existing completed tasks");
  console.log("=".repeat(70));

  // Find all completed tasks that don't have an outcome evaluation yet
  const completedTasks = await db.task.findMany({
    where: { status: "completed" },
    select: { id: true, title: true, employeeId: true, workspaceId: true, completedAt: true },
    orderBy: { completedAt: "asc" },
  });

  console.log(`\nFound ${completedTasks.length} completed tasks.`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of completedTasks) {
    // Check if an evaluation already exists
    const existing = await db.outcomeEvaluation.findUnique({
      where: { taskId: task.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      console.log(`\n[${processed + skipped + 1}/${completedTasks.length}] Processing: ${task.title.slice(0, 60)}`);
      await evaluateAndLearn({
        taskId: task.id,
        employeeId: task.employeeId,
        workspaceId: task.workspaceId,
      });
      processed++;
      console.log("  ✓ Learning pipeline completed");
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed:`, err);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Backfill complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
  console.log("=".repeat(70));

  // Print summary stats
  const stats = await Promise.all([
    db.outcomeEvaluation.count(),
    db.skillReinforcement.count(),
    db.learningPattern.count(),
    db.employeeWeakness.count(),
    db.employeeStrength.count(),
    db.businessOutcome.count(),
    db.careerTimelineEntry.count(),
    db.achievement.count(),
    db.employeeAchievement.count(),
  ]);

  console.log("\nDatabase stats:");
  console.log("  OutcomeEvaluations:", stats[0]);
  console.log("  SkillReinforcements:", stats[1]);
  console.log("  LearningPatterns:", stats[2]);
  console.log("  EmployeeWeaknesses:", stats[3]);
  console.log("  EmployeeStrengths:", stats[4]);
  console.log("  BusinessOutcomes:", stats[5]);
  console.log("  CareerTimelineEntries:", stats[6]);
  console.log("  Achievements (definitions):", stats[7]);
  console.log("  EmployeeAchievements (unlocks):", stats[8]);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
