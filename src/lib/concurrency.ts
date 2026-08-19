/**
 * OWNARA — Database Concurrency Abstraction Layer
 *
 * Makes the runtime database-portable: the same codebase runs on
 *   • SQLite  — for local development, demos, and single-tenant design-partner
 *               deployments (zero-ops, persistent file, survives restarts).
 *   • PostgreSQL — for production multi-worker, multi-workspace deployments
 *                  (full row-level locking + advisory locks).
 *
 * The provider is detected once from DATABASE_URL and cached. All
 * provider-specific raw SQL is encapsulated here so the rest of the
 * codebase (worker, audit, executor) stays provider-agnostic.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * PostgreSQL offers two concurrency primitives that SQLite does not:
 *   1. SELECT ... FOR UPDATE SKIP LOCKED  — atomic, non-blocking row claim.
 *   2. pg_advisory_xact_lock              — transaction-scoped named lock.
 *
 * Rather than hard-coupling the runtime to PostgreSQL (which forces every
 * developer/demo environment to run a Postgres server), we branch on the
 * provider:
 *   • On PostgreSQL we use the native primitives (proven under stress —
 *     see Phase 22 concurrency tests: approve/reject/refresh/audit all
 *     race-safe).
 *   • On SQLite we rely on its single-writer model (WAL mode serializes
 *     writes) plus the @@unique([workspaceId, sequenceNumber]) constraint
 *     on AuditLog which makes hash-chain collisions impossible at the
 *     storage level. The single-worker dev topology means task-claim
 *     races do not occur in practice.
 *
 * Switching providers is a one-line change: set DATABASE_URL and run
 * `bun run db:push`. No code changes required.
 */

import type { PrismaClient } from "@prisma/client";

export type DbProvider = "sqlite" | "postgresql";

/**
 * The Prisma transaction client type — the same `tx` passed to
 * `db.$transaction(async (tx) => ...)`.
 */
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface ClaimedTask {
  id: string;
  title: string;
  status: string;
  employeeId: string;
}

let cachedProvider: DbProvider | null = null;

/**
 * Detects the database provider from DATABASE_URL.
 * Cached after the first call.
 *
 *   file:...        → sqlite
 *   postgresql://…  → postgresql
 *   postgres://…    → postgresql
 */
export function getDbProvider(): DbProvider {
  if (cachedProvider) return cachedProvider;
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    cachedProvider = "sqlite";
  } else if (
    url.startsWith("postgresql://") ||
    url.startsWith("postgres://")
  ) {
    cachedProvider = "postgresql";
  } else {
    // Default to SQLite for safety (zero-ops, always works).
    cachedProvider = "sqlite";
  }
  return cachedProvider;
}

/**
 * Atomically claims the oldest runnable task for processing.
 *
 * PostgreSQL: uses `SELECT ... FOR UPDATE SKIP LOCKED` so that multiple
 *   workers never pick up the same task and never block each other. The
 *   row lock is held until the claim transaction commits.
 *
 * SQLite: uses a plain `findFirst`. SQLite's WAL mode serializes writes
 *   at the database level, and the development topology runs a single
 *   worker process, so concurrent claims do not occur. The
 *   `@@unique([workspaceId, sequenceNumber])` on AuditLog (written during
 *   processing) provides the storage-level integrity guarantee.
 *
 * MUST be called inside a `db.$transaction`. The lock is released when
 * the transaction commits (PG) or is inherently scoped to the findFirst
 * (SQLite — no persistent lock is held).
 */
export async function claimNextTask(
  tx: Tx
): Promise<ClaimedTask | null> {
  if (getDbProvider() === "postgresql") {
    const result = await tx.$queryRaw<ClaimedTask[]>`
      SELECT "id", "title", "status", "employeeId"
      FROM "public"."Task"
      WHERE "status" IN ('queued', 'executing')
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    return (result && result.length > 0) ? result[0] : null;
  }

  // SQLite path
  const task = await tx.task.findFirst({
    where: { status: { in: ["queued", "executing"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, status: true, employeeId: true },
  });
  return task ?? null;
}

/**
 * Acquires a per-workspace serialization lock for audit-chain appends.
 *
 * PostgreSQL: `pg_advisory_xact_lock(hashtext(workspaceId))` — held until
 *   the transaction commits. Different workspaces hash to different lock
 *   keys and proceed in parallel. This guarantees monotonic sequence
 *   numbers without retry.
 *
 * SQLite: no-op. SQLite's single-writer model naturally serializes the
 *   read-then-write sequence of an audit append, and the
 *   `@@unique([workspaceId, sequenceNumber])` constraint makes duplicate
 *   sequence numbers impossible at the storage level. In the rare event
 *   of a collision (only possible with concurrent writers, which the dev
 *   topology does not run), the unique constraint rejects the duplicate
 *   and the transaction fails loudly rather than silently corrupting the
 *   chain.
 *
 * MUST be called inside a `db.$transaction`, before reading the last
 * audit entry.
 */
export async function acquireAuditLock(
  tx: Tx,
  workspaceId: string
): Promise<void> {
  if (getDbProvider() === "postgresql") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
  }
  // SQLite: intentionally no-op (see JSDoc above).
}
