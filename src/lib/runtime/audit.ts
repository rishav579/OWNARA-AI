/**
 * BIHARI AI — Audit Writer
 *
 * Writes hash-chained audit entries within the same transaction as state changes.
 * This is the trust foundation: every action the runtime takes is recorded here,
 * and the hash chain makes tamper detectable.
 *
 * Per DDS-001 §8: append-only, hash-chained per workspace, sequenceNumber is
 * per-workspace monotonic.
 */
import { db } from "@/lib/db";
import { acquireAuditLock } from "@/lib/concurrency";
import crypto from "crypto";

export interface AuditEntryInput {
  workspaceId: string;
  entryType: string;
  actorType: "user" | "employee" | "system";
  actorId: string | null;
  actorName: string;
  targetType: string;
  targetId: string;
  payload: Record<string, string>;
}

/**
 * Appends an audit entry with hash chaining.
 * MUST be called within a $transaction so the audit entry commits atomically
 * with the state change it records.
 *
 * @param tx - A Prisma transaction client
 * @param input - The audit entry data
 */
export async function appendAudit(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  input: AuditEntryInput
): Promise<void> {
  // Serialize concurrent audit appends within the same workspace.
  // Provider-portable (see src/lib/concurrency.ts):
  //   • PostgreSQL → pg_advisory_xact_lock (held until commit; different
  //     workspaces proceed in parallel).
  //   • SQLite → no-op (single-writer serialization + the
  //     @@unique([workspaceId, sequenceNumber]) constraint protect the chain).
  await acquireAuditLock(tx, input.workspaceId);

  // Get the last entry in this workspace's chain
  const lastEntry = await tx.auditLog.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { sequenceNumber: "desc" },
  });

  const sequenceNumber = (lastEntry?.sequenceNumber ?? 0) + 1;
  const previousHash = lastEntry?.entryHash ?? null;
  const createdAt = new Date();

  // Canonical representation for hashing
  const canonical = JSON.stringify({
    workspaceId: input.workspaceId,
    sequenceNumber,
    entryType: input.entryType,
    actorType: input.actorType,
    actorName: input.actorName,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: input.payload,
    createdAt: createdAt.toISOString(),
  });

  const entryHash = crypto
    .createHash("sha256")
    .update((previousHash ?? "") + canonical)
    .digest("hex");

  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      sequenceNumber,
      entryType: input.entryType,
      actorType: input.actorType,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: JSON.stringify(input.payload),
      previousHash,
      entryHash,
      createdAt,
    },
  });
}

/**
 * Verifies the hash chain integrity for a workspace.
 * Returns { valid: boolean, brokenAt?: number }.
 */
export async function verifyAuditChain(
  workspaceId: string
): Promise<{ valid: boolean; brokenAt: number | null; totalEntries: number }> {
  const entries = await db.auditLog.findMany({
    where: { workspaceId },
    orderBy: { sequenceNumber: "asc" },
  });

  if (entries.length === 0) {
    return { valid: true, brokenAt: null, totalEntries: 0 };
  }

  let previousHash: string | null = null;

  for (const entry of entries) {
    // Check previousHash linkage
    if (entry.previousHash !== previousHash) {
      return { valid: false, brokenAt: entry.sequenceNumber, totalEntries: entries.length };
    }

    // Recompute the hash and compare
    const canonical = JSON.stringify({
      workspaceId: entry.workspaceId,
      sequenceNumber: entry.sequenceNumber,
      entryType: entry.entryType,
      actorType: entry.actorType,
      actorName: entry.actorName,
      targetType: entry.targetType,
      targetId: entry.targetId,
      payload: JSON.parse(entry.payload),
      createdAt: entry.createdAt.toISOString(),
    });

    const expectedHash = crypto
      .createHash("sha256")
      .update((previousHash ?? "") + canonical)
      .digest("hex");

    if (entry.entryHash !== expectedHash) {
      return { valid: false, brokenAt: entry.sequenceNumber, totalEntries: entries.length };
    }

    previousHash = entry.entryHash;
  }

  return { valid: true, brokenAt: null, totalEntries: entries.length };
}
