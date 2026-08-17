/**
 * OWNARA — CSV Date Parsing Test Suite
 */

import { parseFlexibleDate } from "../src/app/api/finance/import/route";

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

async function run() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  OWNARA — CSV Flexible Date Parsing Test Suite          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await test("1. ISO format (YYYY-MM-DD)", async () => {
    const d = parseFlexibleDate("2025-07-25");
    assert(d.getUTCFullYear() === 2025 && d.getUTCMonth() === 6 && d.getUTCDate() === 25, "Parsed 2025-07-25 correctly");
  });

  await test("2. Indian/UK Slash format (DD/MM/YYYY)", async () => {
    const d = parseFlexibleDate("25/07/2025");
    assert(d.getUTCFullYear() === 2025 && d.getUTCMonth() === 6 && d.getUTCDate() === 25, "Parsed 25/07/2025 correctly");
  });

  await test("3. Indian/UK Hyphen format (DD-MM-YYYY)", async () => {
    const d = parseFlexibleDate("15-08-2025");
    assert(d.getUTCFullYear() === 2025 && d.getUTCMonth() === 7 && d.getUTCDate() === 15, "Parsed 15-08-2025 correctly");
  });

  await test("4. Dot format (DD.MM.YYYY)", async () => {
    const d = parseFlexibleDate("01.12.2025");
    assert(d.getUTCFullYear() === 2025 && d.getUTCMonth() === 11 && d.getUTCDate() === 1, "Parsed 01.12.2025 correctly");
  });

  await test("5. Invalid calendar values reject cleanly", async () => {
    try {
      parseFlexibleDate("35/13/2025");
      assert(false, "Should have thrown for 35/13/2025");
    } catch (err: any) {
      assert(err.message.includes("Invalid date values"), `Clean rejection: ${err.message}`);
    }
  });

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
