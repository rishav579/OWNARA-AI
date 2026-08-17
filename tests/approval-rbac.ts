/**
 * OWNARA — Approval RBAC & Boundary Authorization Test Suite
 */

import { hasPermission, WorkspaceRole } from "../src/lib/auth";

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
  console.log("║  OWNARA — Approval RBAC Authorization Test Suite        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await test("1. Owner Role Permissions", async () => {
    assert(hasPermission("owner", "approvals.decide") === true, "Owner has approvals.decide permission");
    assert(hasPermission("owner", "workspace.manage") === true, "Owner has workspace.manage permission");
  });

  await test("2. Manager Role Permissions", async () => {
    assert(hasPermission("manager", "approvals.decide") === true, "Manager has approvals.decide permission");
    assert(hasPermission("manager", "workspace.manage") === false, "Manager does NOT have workspace.manage");
  });

  await test("3. Finance Role Permissions", async () => {
    assert(hasPermission("finance", "approvals.decide") === true, "Finance role has approvals.decide permission");
  });

  await test("4. Viewer Role Denial", async () => {
    assert(hasPermission("viewer", "approvals.decide") === false, "Viewer role is DENIED approvals.decide");
  });

  await test("5. Generic Member / Unknown Role Denial", async () => {
    assert(hasPermission("member", "approvals.decide") === false, "Member role is DENIED approvals.decide");
    assert(hasPermission(undefined, "approvals.decide") === false, "Undefined role is DENIED approvals.decide");
    assert(hasPermission("guest", "approvals.decide") === false, "Guest role is DENIED approvals.decide");
  });

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
