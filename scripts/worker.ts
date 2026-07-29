#!/usr/bin/env bun
/**
 * BIHARI AI — Worker Process
 *
 * Runs the AI Employee Runtime worker as a separate process.
 *
 * Usage:
 *   bun run scripts/worker.ts
 *
 * Or via package.json:
 *   bun run worker
 *
 * The worker connects to the same database as the Next.js app and polls for
 * runnable tasks. It processes one step per tick (2 seconds) and handles:
 * - Planning (generating step sequences)
 * - Execution (reasoning, tool calls)
 * - Approval gates (creating approvals, pausing execution)
 * - Completion and failure
 *
 * Per BED-001 §8: "A Python process running the custom worker loop, same image
 * as the API, different entrypoint." (Adapted to TypeScript for this stack.)
 */

import { startWorker } from "../src/lib/runtime/worker";

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Worker] Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Worker] Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled rejection:", reason);
  process.exit(1);
});

// Start the worker
startWorker().catch((err) => {
  console.error("[Worker] Failed to start:", err);
  process.exit(1);
});
