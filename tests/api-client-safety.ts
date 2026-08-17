/**
 * OWNARA — API Client Robustness Test Suite
 *
 * Tests all response parsing edge cases for apiFetch.
 */

import { apiFetch, ApiError } from "../src/lib/app/api-client";

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
  console.log("║  OWNARA — apiFetch Robustness Test Suite                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const originalFetch = global.fetch;

  try {
    await test("1. Valid JSON 200 response with { success: true, data: { ... } }", async () => {
      global.fetch = async () =>
        new Response(JSON.stringify({ success: true, data: { status: "healthy", items: [1, 2, 3] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      const res = await apiFetch("/test");
      assert(res.status === "healthy" && res.items.length === 3, "Parsed data object correctly");
    });

    await test("2. Valid JSON error response with { success: false, error: { code, message } }", async () => {
      global.fetch = async () =>
        new Response(JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: "Access denied" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });

      try {
        await apiFetch("/test");
        assert(false, "Should have thrown ApiError");
      } catch (err: any) {
        assert(err instanceof ApiError, "Threw ApiError instance");
        assert(err.code === "FORBIDDEN", `Correct error code (got ${err.code})`);
        assert(err.status === 403, `Correct status 403 (got ${err.status})`);
      }
    });

    await test("3. Empty 204 No Content response", async () => {
      global.fetch = async () =>
        new Response(null, {
          status: 204,
          statusText: "No Content",
        });

      const res = await apiFetch("/test");
      assert(typeof res === "object" && res !== null, "Safely handled 204 No Content without throwing JSON error");
    });

    await test("4. Empty 500 error response", async () => {
      global.fetch = async () =>
        new Response("", {
          status: 500,
          statusText: "Internal Server Error",
        });

      try {
        await apiFetch("/test");
        assert(false, "Should have thrown ApiError on empty 500");
      } catch (err: any) {
        assert(err instanceof ApiError, "Threw ApiError on empty 500");
        assert(err.status === 500, `Correct status 500 (got ${err.status})`);
      }
    });

    await test("5. HTML 502 / 503 Bad Gateway from reverse proxy", async () => {
      global.fetch = async () =>
        new Response("<html><body><h1>502 Bad Gateway</h1></body></html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "Content-Type": "text/html" },
        });

      try {
        await apiFetch("/test");
        assert(false, "Should have thrown ApiError on HTML 502");
      } catch (err: any) {
        assert(err instanceof ApiError, "Threw ApiError on HTML 502");
        assert(err.status === 502, `Correct status 502 (got ${err.status})`);
        assert(err.message.includes("Bad Gateway"), `Clean error message: ${err.message}`);
      }
    });

    await test("6. Malformed JSON with 200 status", async () => {
      global.fetch = async () =>
        new Response("{ malformed_json: true, ...", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      try {
        await apiFetch("/test");
        assert(false, "Should have thrown on malformed JSON");
      } catch (err: any) {
        assert(err instanceof ApiError, "Threw ApiError on malformed JSON");
        assert(err.code === "INVALID_JSON", `Error code is INVALID_JSON (got ${err.code})`);
      }
    });
  } finally {
    global.fetch = originalFetch;
  }

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
