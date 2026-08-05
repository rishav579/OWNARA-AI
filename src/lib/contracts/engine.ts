/**
 * BIHARI AI — Execution Contract Engine
 *
 * Generates immutable Execution Contracts before ANY irreversible tool
 * execution. A contract is the formal agreement between the AI Employee
 * and the human approver: it defines EXACTLY what will happen, why, what
 * evidence supports it, what policies govern it, and how to roll it back.
 *
 * Contract Lifecycle:
 *   draft → pending_approval → approved (immutable) OR rejected (permanent, searchable)
 *                            ↑
 *                     If the human modifies the action:
 *                     A new version (V2, V3...) is created.
 *                     The old version is superseded.
 *                     The new version goes to pending_approval.
 *
 * Key invariants:
 * - Approved contracts are IMMUTABLE — no field can change after approval
 * - Rejected contracts remain permanently searchable (for audit and learning)
 * - Every contract has a SHA-256 hash included in the audit chain
 * - Every approval references a Contract ID (not mutable task state)
 * - Future Digital Employees use this engine automatically (generic — no domain logic)
 *
 * This module is NOT finance-specific. Any employee (HR, Sales, Legal, etc.)
 * that needs to execute an irreversible action generates a contract first.
 */

import { db } from "@/lib/db";
import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContractInput {
  taskId: string;
  employeeId: string;
  workspaceId: string;
  goal: string;
  proposedAction: Record<string, string>;
  confidence: number;
  evidence: Array<{ source: string; fact: string; weight: string }>;
  memoriesUsed: Array<{ memoryType: string; entityId: string; key: string }>;
  policiesUsed: Array<{ code: string; name: string }>;
  businessImpact: string;
  affectedSystems: string[];
  rollbackPlan: string;
  estimatedBusinessOutcome: string;
  estimatedTokenCost: number;
  estimatedExecutionTime: number;
  requiredAuthority: string;
}

export interface ContractRecord {
  id: string;
  workspaceId: string;
  taskId: string;
  employeeId: string;
  contractNumber: string;
  version: number;
  status: string;
  goal: string;
  proposedAction: Record<string, string>;
  confidence: number;
  evidence: Array<{ source: string; fact: string; weight: string }>;
  memoriesUsed: Array<{ memoryType: string; entityId: string; key: string }>;
  policiesUsed: Array<{ code: string; name: string }>;
  businessImpact: string;
  affectedSystems: string[];
  rollbackPlan: string;
  estimatedBusinessOutcome: string;
  estimatedTokenCost: number;
  estimatedExecutionTime: number;
  requiredAuthority: string;
  contractHash: string;
  generatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  supersededAt: Date | null;
  parentContractId: string | null;
}

// ─── Contract Generation ─────────────────────────────────────────────────────

/**
 * Generates a new Execution Contract (Version 1).
 *
 * This is called by the executor BEFORE creating an approval gate.
 * The contract captures the complete state of the decision at the moment
 * it was made — if the human later modifies the action, a new version
 * is created (V2) referencing the original as parent.
 *
 * @param input - The 17 required contract fields
 * @returns The created contract record (with hash)
 */
export async function generateContract(input: ContractInput): Promise<ContractRecord> {
  // Generate the next contract number for this workspace
  const lastContract = await db.executionContract.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { generatedAt: "desc" },
  });

  let contractNumber: string;
  if (lastContract) {
    // Extract the number from the last contract and increment
    const match = lastContract.contractNumber.match(/EC-(\d+)/);
    const nextNum = match ? parseInt(match[1]) + 1 : 1;
    contractNumber = `EC-${String(nextNum).padStart(4, "0")}`;
  } else {
    contractNumber = "EC-0001";
  }

  // Build the canonical content for hashing
  const canonicalContent = buildCanonicalContent({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    employeeId: input.employeeId,
    contractNumber,
    version: 1,
    goal: input.goal,
    proposedAction: input.proposedAction,
    confidence: input.confidence,
    evidence: input.evidence,
    memoriesUsed: input.memoriesUsed,
    policiesUsed: input.policiesUsed,
    businessImpact: input.businessImpact,
    affectedSystems: input.affectedSystems,
    rollbackPlan: input.rollbackPlan,
    estimatedBusinessOutcome: input.estimatedBusinessOutcome,
    estimatedTokenCost: input.estimatedTokenCost,
    estimatedExecutionTime: input.estimatedExecutionTime,
    requiredAuthority: input.requiredAuthority,
    generatedAt: new Date().toISOString(),
  });

  const contractHash = hashContent(canonicalContent);

  // Create the contract
  const contract = await db.executionContract.create({
    data: {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      contractNumber,
      version: 1,
      status: "pending_approval",
      goal: input.goal,
      proposedAction: JSON.stringify(input.proposedAction),
      confidence: input.confidence,
      evidence: JSON.stringify(input.evidence),
      memoriesUsed: JSON.stringify(input.memoriesUsed),
      policiesUsed: JSON.stringify(input.policiesUsed),
      businessImpact: input.businessImpact,
      affectedSystems: JSON.stringify(input.affectedSystems),
      rollbackPlan: input.rollbackPlan,
      estimatedBusinessOutcome: input.estimatedBusinessOutcome,
      estimatedTokenCost: input.estimatedTokenCost,
      estimatedExecutionTime: input.estimatedExecutionTime,
      requiredAuthority: input.requiredAuthority,
      contractHash,
    },
  });

  return serializeContract(contract);
}

/**
 * Transactional version of generateContract.
 * Accepts a Prisma transaction client so the contract creation is atomic
 * with the rest of the executor's state changes.
 *
 * This prevents orphaned contracts if the approval creation or audit
 * log write fails after the contract is generated.
 */
export async function generateContractInternal(
  tx: Parameters<Parameters<typeof db["$transaction"]>[0]>[0],
  input: ContractInput
): Promise<ContractRecord> {
  const lastContract = await tx.executionContract.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { generatedAt: "desc" },
  });

  let contractNumber: string;
  if (lastContract) {
    const match = lastContract.contractNumber.match(/EC-(\d+)/);
    const nextNum = match ? parseInt(match[1]) + 1 : 1;
    contractNumber = `EC-${String(nextNum).padStart(4, "0")}`;
  } else {
    contractNumber = "EC-0001";
  }

  const canonicalContent = buildCanonicalContent({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    employeeId: input.employeeId,
    contractNumber,
    version: 1,
    goal: input.goal,
    proposedAction: input.proposedAction,
    confidence: input.confidence,
    evidence: input.evidence,
    memoriesUsed: input.memoriesUsed,
    policiesUsed: input.policiesUsed,
    businessImpact: input.businessImpact,
    affectedSystems: input.affectedSystems,
    rollbackPlan: input.rollbackPlan,
    estimatedBusinessOutcome: input.estimatedBusinessOutcome,
    estimatedTokenCost: input.estimatedTokenCost,
    estimatedExecutionTime: input.estimatedExecutionTime,
    requiredAuthority: input.requiredAuthority,
    generatedAt: new Date().toISOString(),
  });

  const contractHash = hashContent(canonicalContent);

  const contract = await tx.executionContract.create({
    data: {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      contractNumber,
      version: 1,
      status: "pending_approval",
      goal: input.goal,
      proposedAction: JSON.stringify(input.proposedAction),
      confidence: input.confidence,
      evidence: JSON.stringify(input.evidence),
      memoriesUsed: JSON.stringify(input.memoriesUsed),
      policiesUsed: JSON.stringify(input.policiesUsed),
      businessImpact: input.businessImpact,
      affectedSystems: JSON.stringify(input.affectedSystems),
      rollbackPlan: input.rollbackPlan,
      estimatedBusinessOutcome: input.estimatedBusinessOutcome,
      estimatedTokenCost: input.estimatedTokenCost,
      estimatedExecutionTime: input.estimatedExecutionTime,
      requiredAuthority: input.requiredAuthority,
      contractHash,
    },
  });

  return serializeContract(contract);
}

/**
 * Creates a new version of an existing contract (V2, V3, etc.).
 * The old version is marked as "superseded". The new version starts
 * as "pending_approval".
 *
 * This is called when the human modifies the proposed action during
 * the approval process.
 */
export async function createContractVersion(
  parentContractId: string,
  modifications: Partial<ContractInput>
): Promise<ContractRecord> {
  const parent = await db.executionContract.findUnique({
    where: { id: parentContractId },
  });

  if (!parent) {
    throw new Error(`Parent contract not found: ${parentContractId}`);
  }

  if (parent.status === "approved") {
    throw new Error("Cannot modify an approved contract — it is immutable");
  }

  const newVersion = parent.version + 1;

  // Merge parent fields with modifications
  const mergedInput: ContractInput = {
    taskId: parent.taskId,
    employeeId: parent.employeeId,
    workspaceId: parent.workspaceId,
    goal: modifications.goal || parent.goal,
    proposedAction: modifications.proposedAction || JSON.parse(parent.proposedAction),
    confidence: modifications.confidence !== undefined ? modifications.confidence : parent.confidence,
    evidence: modifications.evidence || JSON.parse(parent.evidence),
    memoriesUsed: modifications.memoriesUsed || JSON.parse(parent.memoriesUsed),
    policiesUsed: modifications.policiesUsed || JSON.parse(parent.policiesUsed),
    businessImpact: modifications.businessImpact || parent.businessImpact,
    affectedSystems: modifications.affectedSystems || JSON.parse(parent.affectedSystems),
    rollbackPlan: modifications.rollbackPlan || parent.rollbackPlan,
    estimatedBusinessOutcome: modifications.estimatedBusinessOutcome || parent.estimatedBusinessOutcome,
    estimatedTokenCost: modifications.estimatedTokenCost !== undefined ? modifications.estimatedTokenCost : parent.estimatedTokenCost,
    estimatedExecutionTime: modifications.estimatedExecutionTime !== undefined ? modifications.estimatedExecutionTime : parent.estimatedExecutionTime,
    requiredAuthority: modifications.requiredAuthority || parent.requiredAuthority,
  };

  // Build canonical content for the new version
  const canonicalContent = buildCanonicalContent({
    workspaceId: mergedInput.workspaceId,
    taskId: mergedInput.taskId,
    employeeId: mergedInput.employeeId,
    contractNumber: parent.contractNumber,
    version: newVersion,
    goal: mergedInput.goal,
    proposedAction: mergedInput.proposedAction,
    confidence: mergedInput.confidence,
    evidence: mergedInput.evidence,
    memoriesUsed: mergedInput.memoriesUsed,
    policiesUsed: mergedInput.policiesUsed,
    businessImpact: mergedInput.businessImpact,
    affectedSystems: mergedInput.affectedSystems,
    rollbackPlan: mergedInput.rollbackPlan,
    estimatedBusinessOutcome: mergedInput.estimatedBusinessOutcome,
    estimatedTokenCost: mergedInput.estimatedTokenCost,
    estimatedExecutionTime: mergedInput.estimatedExecutionTime,
    requiredAuthority: mergedInput.requiredAuthority,
    generatedAt: new Date().toISOString(),
  });

  const contractHash = hashContent(canonicalContent);

  // Mark the parent as superseded
  await db.executionContract.update({
    where: { id: parentContractId },
    data: { status: "superseded", supersededAt: new Date() },
  });

  // Create the new version
  const contract = await db.executionContract.create({
    data: {
      workspaceId: mergedInput.workspaceId,
      taskId: mergedInput.taskId,
      employeeId: mergedInput.employeeId,
      contractNumber: parent.contractNumber, // Same number, new version
      version: newVersion,
      parentContractId,
      status: "pending_approval",
      goal: mergedInput.goal,
      proposedAction: JSON.stringify(mergedInput.proposedAction),
      confidence: mergedInput.confidence,
      evidence: JSON.stringify(mergedInput.evidence),
      memoriesUsed: JSON.stringify(mergedInput.memoriesUsed),
      policiesUsed: JSON.stringify(mergedInput.policiesUsed),
      businessImpact: mergedInput.businessImpact,
      affectedSystems: JSON.stringify(mergedInput.affectedSystems),
      rollbackPlan: mergedInput.rollbackPlan,
      estimatedBusinessOutcome: mergedInput.estimatedBusinessOutcome,
      estimatedTokenCost: mergedInput.estimatedTokenCost,
      estimatedExecutionTime: mergedInput.estimatedExecutionTime,
      requiredAuthority: mergedInput.requiredAuthority,
      contractHash,
    },
  });

  return serializeContract(contract);
}

// ─── Contract Lifecycle ──────────────────────────────────────────────────────

/**
 * Marks a contract as approved. Once approved, the contract is IMMUTABLE.
 * No field can ever change. The contract hash is locked.
 */
export async function approveContract(
  contractId: string,
  approvedBy: string
): Promise<ContractRecord> {
  const contract = await db.executionContract.findUnique({
    where: { id: contractId },
  });

  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  if (contract.status !== "pending_approval") {
    throw new Error(`Contract ${contract.contractNumber} v${contract.version} is ${contract.status}, cannot approve`);
  }

  const updated = await db.executionContract.update({
    where: { id: contractId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedBy,
    },
  });

  return serializeContract(updated);
}

/**
 * Marks a contract as rejected. Rejected contracts remain permanently
 * searchable for audit and learning purposes.
 */
export async function rejectContract(
  contractId: string,
  rejectedBy: string,
  reason?: string
): Promise<ContractRecord> {
  const contract = await db.executionContract.findUnique({
    where: { id: contractId },
  });

  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  if (contract.status !== "pending_approval") {
    throw new Error(`Contract ${contract.contractNumber} v${contract.version} is ${contract.status}, cannot reject`);
  }

  const updated = await db.executionContract.update({
    where: { id: contractId },
    data: {
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy,
      rejectionReason: reason || null,
    },
  });

  return serializeContract(updated);
}

/**
 * Links an approval record to a contract.
 * This is called when the approval is created in the executor.
 */
export async function linkApprovalToContract(
  contractId: string,
  approvalId: string
): Promise<void> {
  await db.executionContract.update({
    where: { id: contractId },
    data: { approvalId },
  });
}

// ─── Contract Retrieval ──────────────────────────────────────────────────────

/**
 * Gets a contract by ID.
 */
export async function getContract(contractId: string): Promise<ContractRecord | null> {
  const contract = await db.executionContract.findUnique({
    where: { id: contractId },
  });
  return contract ? serializeContract(contract) : null;
}

/**
 * Gets the active (pending_approval) contract for a task.
 * Returns null if no pending contract exists.
 */
export async function getPendingContractForTask(taskId: string): Promise<ContractRecord | null> {
  const contract = await db.executionContract.findFirst({
    where: { taskId, status: "pending_approval" },
    orderBy: { version: "desc" },
  });
  return contract ? serializeContract(contract) : null;
}

/**
 * Gets all versions of a contract (by contract number).
 */
export async function getContractVersions(
  workspaceId: string,
  contractNumber: string
): Promise<ContractRecord[]> {
  const contracts = await db.executionContract.findMany({
    where: { workspaceId, contractNumber },
    orderBy: { version: "asc" },
  });
  return contracts.map(serializeContract);
}

/**
 * Searches contracts by status, employee, or task.
 * Rejected contracts are always searchable.
 */
export async function searchContracts(
  workspaceId: string,
  filters: {
    status?: string;
    employeeId?: string;
    taskId?: string;
    contractNumber?: string;
  }
): Promise<ContractRecord[]> {
  const where: any = { workspaceId };
  if (filters.status) where.status = filters.status;
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.taskId) where.taskId = filters.taskId;
  if (filters.contractNumber) where.contractNumber = filters.contractNumber;

  const contracts = await db.executionContract.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    take: 50,
  });
  return contracts.map(serializeContract);
}

/**
 * Verifies the hash of a contract.
 * Recomputes the hash from the stored content and compares.
 */
export function verifyContractHash(contract: ContractRecord): boolean {
  const canonical = buildCanonicalContent({
    workspaceId: contract.workspaceId || "",
    taskId: contract.taskId,
    employeeId: contract.employeeId,
    contractNumber: contract.contractNumber,
    version: contract.version,
    goal: contract.goal,
    proposedAction: contract.proposedAction,
    confidence: contract.confidence,
    evidence: contract.evidence,
    memoriesUsed: contract.memoriesUsed,
    policiesUsed: contract.policiesUsed,
    businessImpact: contract.businessImpact,
    affectedSystems: contract.affectedSystems,
    rollbackPlan: contract.rollbackPlan,
    estimatedBusinessOutcome: contract.estimatedBusinessOutcome,
    estimatedTokenCost: contract.estimatedTokenCost,
    estimatedExecutionTime: contract.estimatedExecutionTime,
    requiredAuthority: contract.requiredAuthority,
    generatedAt: contract.generatedAt.toISOString(),
  });

  const recomputedHash = hashContent(canonical);
  return recomputedHash === contract.contractHash;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Builds the canonical representation of a contract for hashing.
 * The order of fields is fixed and deterministic.
 */
function buildCanonicalContent(data: {
  workspaceId: string;
  taskId: string;
  employeeId: string;
  contractNumber: string;
  version: number;
  goal: string;
  proposedAction: Record<string, string>;
  confidence: number;
  evidence: Array<{ source: string; fact: string; weight: string }>;
  memoriesUsed: Array<{ memoryType: string; entityId: string; key: string }>;
  policiesUsed: Array<{ code: string; name: string }>;
  businessImpact: string;
  affectedSystems: string[];
  rollbackPlan: string;
  estimatedBusinessOutcome: string;
  estimatedTokenCost: number;
  estimatedExecutionTime: number;
  requiredAuthority: string;
  generatedAt: string;
}): string {
  return JSON.stringify({
    workspaceId: data.workspaceId,
    taskId: data.taskId,
    employeeId: data.employeeId,
    contractNumber: data.contractNumber,
    version: data.version,
    goal: data.goal,
    proposedAction: data.proposedAction,
    confidence: data.confidence,
    evidence: data.evidence,
    memoriesUsed: data.memoriesUsed,
    policiesUsed: data.policiesUsed,
    businessImpact: data.businessImpact,
    affectedSystems: data.affectedSystems,
    rollbackPlan: data.rollbackPlan,
    estimatedBusinessOutcome: data.estimatedBusinessOutcome,
    estimatedTokenCost: data.estimatedTokenCost,
    estimatedExecutionTime: data.estimatedExecutionTime,
    requiredAuthority: data.requiredAuthority,
    generatedAt: data.generatedAt,
  });
}

/**
 * Computes SHA-256 hash of the canonical content.
 */
function hashContent(canonical: string): string {
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Serializes a database record into a ContractRecord.
 */
function serializeContract(c: any): ContractRecord {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    taskId: c.taskId,
    employeeId: c.employeeId,
    contractNumber: c.contractNumber,
    version: c.version,
    status: c.status,
    goal: c.goal,
    proposedAction: JSON.parse(c.proposedAction),
    confidence: c.confidence,
    evidence: JSON.parse(c.evidence),
    memoriesUsed: JSON.parse(c.memoriesUsed),
    policiesUsed: JSON.parse(c.policiesUsed),
    businessImpact: c.businessImpact,
    affectedSystems: JSON.parse(c.affectedSystems),
    rollbackPlan: c.rollbackPlan,
    estimatedBusinessOutcome: c.estimatedBusinessOutcome,
    estimatedTokenCost: c.estimatedTokenCost,
    estimatedExecutionTime: c.estimatedExecutionTime,
    requiredAuthority: c.requiredAuthority,
    contractHash: c.contractHash,
    generatedAt: c.generatedAt,
    approvedAt: c.approvedAt,
    approvedBy: c.approvedBy,
    rejectedAt: c.rejectedAt,
    rejectedBy: c.rejectedBy,
    rejectionReason: c.rejectionReason,
    supersededAt: c.supersededAt,
    parentContractId: c.parentContractId,
  };
}
