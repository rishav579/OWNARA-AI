/**
 * OWNARA — LLM Request/Response Logger
 *
 * Logs every LLM call to the database (LlmUsage table) and to the console.
 * Records: provider, model, task type, prompt ID, token usage, estimated
 * cost, latency, cache hit, success/failure, guardrail violations, and
 * execution ID for tracing.
 *
 * This is the SAME LlmUsage table defined in the original Prisma schema.
 * The logger writes to it via the shared Prisma client.
 *
 * If the database write fails, the log entry is still written to console
 * — logging never blocks or fails the LLM call.
 */

import { db } from "@/lib/db";
import type { LLMLogEntry, LLMRequest, LLMResponse } from "./types";

/**
 * Logs an LLM call to the database and console.
 */
export async function logLLMCall(
  request: LLMRequest,
  response: LLMResponse | null,
  error: string | null,
  guardrailViolations: string[] | null,
  promptId?: string,
  promptVersion?: number
): Promise<void> {
  const entry: LLMLogEntry = {
    executionId: response?.executionId || request.executionId || "unknown",
    workspaceId: request.workspaceId,
    employeeId: request.employeeId,
    taskId: request.taskId,
    provider: response?.provider || "unknown",
    model: response?.model || request.model || "unknown",
    taskType: request.taskType,
    promptId,
    promptVersion,
    promptTokens: response?.promptTokens || 0,
    completionTokens: response?.completionTokens || 0,
    totalTokens: response?.totalTokens || 0,
    estimatedCostCents: response?.estimatedCostCents || 0,
    latencyMs: response?.latencyMs || 0,
    cached: response?.cached || false,
    success: !!response && !error,
    errorMessage: error || undefined,
    guardrailViolations: guardrailViolations && guardrailViolations.length > 0 ? guardrailViolations : undefined,
    createdAt: new Date(),
  };

  // Console log (always)
  const status = entry.success ? "✓" : "✗";
  const cached = entry.cached ? " (cached)" : "";
  console.log(
    `[LLM] ${status} ${entry.provider}/${entry.model} | ${entry.taskType || "general"} | ` +
    `${entry.totalTokens} tokens | ${entry.latencyMs}ms | ₹${(entry.estimatedCostCents / 100).toFixed(4)}${cached} | ` +
    `exec=${entry.executionId}` +
    (entry.errorMessage ? ` | ERROR: ${entry.errorMessage.substring(0, 100)}` : "") +
    (entry.guardrailViolations ? ` | GUARDRAILS: ${entry.guardrailViolations.join(", ")}` : "")
  );

  // Database log (best-effort — never blocks)
  // Only write to DB if we have a valid workspaceId (FK constraint)
  if (entry.workspaceId) {
    try {
      await db.llmUsage.create({
        data: {
          workspaceId: entry.workspaceId,
          taskId: entry.taskId || null,
          employeeId: entry.employeeId || null,
          provider: entry.provider,
          model: entry.model,
          promptTokens: entry.promptTokens,
          completionTokens: entry.completionTokens,
          totalTokens: entry.totalTokens,
          costCents: entry.estimatedCostCents,
          latencyMs: entry.latencyMs,
          status: entry.success ? "success" : "error",
          errorMessage: entry.errorMessage,
          createdAt: entry.createdAt,
        },
      });
    } catch (dbErr) {
      // Database logging is best-effort — don't fail the LLM call
      console.error("[LLM Logger] Failed to write to database:", dbErr instanceof Error ? dbErr.message : String(dbErr));
    }
  }
}
