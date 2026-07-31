/**
 * BIHARI AI — LLM Gateway
 *
 * The single entry point for all LLM calls in the system. Combines:
 * - Model routing (selects provider + model based on task type)
 * - Prompt registry (loads, versions, and renders prompt templates)
 * - Input guardrails (injection, unsafe tools, missing fields, policy)
 * - Output guardrails (forbidden content, approval bypass)
 * - JSON validation + auto-repair
 * - Response caching
 * - Request/response logging
 *
 * Usage:
 *   const gateway = getLLMGateway();
 *   const response = await gateway.complete({
 *     taskType: "planning",
 *     promptId: "planning",
 *     variables: { title: "Process invoices", role: "finance_employee", ... },
 *     workspaceId: "...",
 *     employeeId: "...",
 *     taskId: "...",
 *   });
 *
 * The gateway is backward-compatible: if no promptId is provided, it accepts
 * raw messages (like the original provider interface).
 *
 * The existing runtime (executor, planner, finance-planner, brain) does NOT
 * need to change its logic — it calls the gateway instead of calling the
 * mock planner directly. The gateway handles everything else.
 */

import crypto from "crypto";
import type { LLMRequest, LLMResponse, TaskType, LLMProviderError } from "./types";
import { LLMProviderError as ProviderError, LLMGuardrailError } from "./types";
import { getModelRouter } from "./providers/router";
import { getPromptRegistry, type PromptInvocation } from "./prompts/registry";
import { getResponseCache } from "./cache";
import { logLLMCall } from "./logger";
import { checkInputGuardrails, checkOutputGuardrails } from "./guardrails";
import { validateJsonResponse } from "./validator";

// ─── Gateway Request (extends LLMRequest with prompt registry support) ────────

export interface GatewayRequest {
  /** Task type for routing */
  taskType?: TaskType;
  /** Prompt template ID (from the registry). If provided, the gateway loads
   * the template and renders it with the provided variables. */
  promptId?: string;
  /** Variables to interpolate into the prompt template */
  variables?: Record<string, string>;
  /** Or, provide raw messages directly (bypasses the prompt registry) */
  messages?: { role: "system" | "user" | "assistant"; content: string }[];
  /** Model override (if not using the router's default for this task type) */
  model?: string;
  /** Temperature override */
  temperature?: number;
  /** Max tokens override */
  maxTokens?: number;
  /** Whether to validate the response as JSON */
  jsonMode?: boolean;
  /** JSON schema for validation (optional) */
  jsonSchema?: Record<string, unknown>;
  /** Workspace for logging and cost attribution */
  workspaceId?: string;
  /** Employee for logging */
  employeeId?: string;
  /** Task for logging */
  taskId?: string;
  /** Whether to use the response cache (default: true) */
  useCache?: boolean;
}

export interface GatewayResponse {
  content: string;
  /** Parsed JSON data (if jsonMode was true and parsing succeeded) */
  data: unknown | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostCents: number;
  executionId: string;
  cached: boolean;
  /** Whether the JSON was auto-repaired */
  repaired: boolean;
  /** Prompt template that was used */
  promptId?: string;
  promptVersion?: number;
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

export class LLMGateway {
  /**
   * Executes an LLM call through the full gateway pipeline:
   *
   * 1. Load prompt template (if promptId is provided)
   * 2. Render prompt with variables
   * 3. Check input guardrails
   * 4. Check cache
   * 5. Route to provider
   * 6. Execute LLM call (with retry on transient failure)
   * 7. Check output guardrails
   * 8. Validate JSON (if jsonMode)
   * 9. Log the call
   * 10. Cache the response
   * 11. Return the response
   */
  async complete(request: GatewayRequest): Promise<GatewayResponse> {
    const executionId = `llm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const taskType = request.taskType || "general";
    const useCache = request.useCache !== false;

    let promptId: string | undefined;
    let promptVersion: number | undefined;
    let messages: { role: "system" | "user" | "assistant"; content: string }[];
    let guardrailViolations: string[] = [];

    // ─── Step 1+2: Load and render prompt template ──────────────────────────
    if (request.promptId && request.variables) {
      const registry = getPromptRegistry();
      const invocation: PromptInvocation = {
        promptId: request.promptId,
        version: 0, // 0 means "use active version"
        variables: request.variables,
      };

      // Find the active version
      const template = registry.get(request.promptId);
      if (template) {
        invocation.version = template.version;
        promptId = template.id;
        promptVersion = template.version;
      }

      const rendered = registry.render(invocation);
      if (!rendered) {
        throw new Error(`Prompt template not found: ${request.promptId}`);
      }

      messages = [
        { role: "system", content: rendered.systemPrompt },
        { role: "user", content: rendered.userPrompt },
      ];
    } else if (request.messages) {
      messages = request.messages;
    } else {
      throw new Error("GatewayRequest must include either promptId+variables or messages");
    }

    // ─── Step 3: Input guardrails ───────────────────────────────────────────
    const llmRequest: LLMRequest = {
      messages,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      jsonMode: request.jsonMode,
      executionId,
      taskType,
      workspaceId: request.workspaceId,
      employeeId: request.employeeId,
      taskId: request.taskId,
    };

    const inputCheck = checkInputGuardrails(llmRequest);
    if (!inputCheck.passed) {
      guardrailViolations = inputCheck.violations;
      // Log the guardrail violation
      await logLLMCall(llmRequest, null, "Input guardrail violation", guardrailViolations, promptId, promptVersion);
      throw new LLMGuardrailError("input_guardrail", inputCheck.violations.join("; "));
    }

    // ─── Step 4: Check cache ────────────────────────────────────────────────
    const router = getModelRouter();
    const { provider, route } = router.route(taskType);
    const model = request.model || route.model;
    const temperature = request.temperature ?? route.temperature;
    const maxTokens = request.maxTokens ?? route.maxTokens;

    const cache = getResponseCache();
    const cacheKey = cache.key(messages, model, temperature);

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        // Cache hit — log and return
        await logLLMCall(llmRequest, cached, null, null, promptId, promptVersion);

        // Validate JSON if needed
        let data: unknown | null = null;
        let repaired = false;
        if (request.jsonMode) {
          const validation = validateJsonResponse(cached.content, request.jsonSchema);
          data = validation.data;
          repaired = validation.repaired;
        }

        return {
          content: cached.content,
          data,
          model: cached.model,
          provider: cached.provider,
          promptTokens: cached.promptTokens,
          completionTokens: cached.completionTokens,
          totalTokens: cached.totalTokens,
          latencyMs: cached.latencyMs,
          estimatedCostCents: cached.estimatedCostCents,
          executionId: cached.executionId,
          cached: true,
          repaired,
          promptId,
          promptVersion,
        };
      }
    }

    // ─── Step 5+6: Route to provider and execute ────────────────────────────
    let response: LLMResponse;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        response = await provider.complete({
          ...llmRequest,
          model,
          temperature,
          maxTokens,
        });
        break;
      } catch (err) {
        const isProviderError = err instanceof ProviderError || (err as any)?.name === "LLMProviderError";
        const retryable = isProviderError ? (err as any)?.retryable : false;

        if (retryable && retryCount < maxRetries) {
          retryCount++;
          const backoff = Math.pow(2, retryCount) * 1000; // 2s, 4s
          console.log(`[LLM Gateway] Retrying in ${backoff}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // Non-retryable error or max retries exhausted
        const errorMsg = err instanceof Error ? err.message : String(err);
        await logLLMCall(llmRequest, null, errorMsg, guardrailViolations.length > 0 ? guardrailViolations : null, promptId, promptVersion);
        throw err;
      }
    }

    // ─── Step 7: Output guardrails ──────────────────────────────────────────
    const outputCheck = checkOutputGuardrails(response!.content);
    if (!outputCheck.passed) {
      guardrailViolations = outputCheck.violations;
      await logLLMCall(llmRequest, response, "Output guardrail violation", guardrailViolations, promptId, promptVersion);
      throw new LLMGuardrailError("output_guardrail", outputCheck.violations.join("; "));
    }

    // ─── Step 8: Validate JSON (if jsonMode) ────────────────────────────────
    let data: unknown | null = null;
    let repaired = false;
    if (request.jsonMode) {
      const validation = validateJsonResponse(response!.content, request.jsonSchema);
      if (!validation.valid) {
        // Log the validation failure
        await logLLMCall(llmRequest, response, `JSON validation failed: ${validation.error}`, guardrailViolations.length > 0 ? guardrailViolations : null, promptId, promptVersion);
        // Return the raw content — the caller can decide how to handle it
        data = null;
      } else {
        data = validation.data;
        repaired = validation.repaired;
      }
    }

    // ─── Step 9: Log ────────────────────────────────────────────────────────
    await logLLMCall(llmRequest, response, null, null, promptId, promptVersion);

    // ─── Step 10: Cache ─────────────────────────────────────────────────────
    if (useCache) {
      cache.set(cacheKey, response!);
    }

    // ─── Step 11: Return ────────────────────────────────────────────────────
    return {
      content: response!.content,
      data,
      model: response!.model,
      provider: response!.provider,
      promptTokens: response!.promptTokens,
      completionTokens: response!.completionTokens,
      totalTokens: response!.totalTokens,
      latencyMs: response!.latencyMs,
      estimatedCostCents: response!.estimatedCostCents,
      executionId: response!.executionId,
      cached: false,
      repaired,
      promptId,
      promptVersion,
    };
  }

  /**
   * Convenience method for simple text completion (no JSON mode, no prompt registry).
   */
  async text(systemPrompt: string, userPrompt: string, options?: Partial<GatewayRequest>): Promise<string> {
    const response = await this.complete({
      ...options,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.content;
  }

  /**
   * Convenience method for JSON completion (with validation).
   */
  async json(systemPrompt: string, userPrompt: string, schema?: Record<string, unknown>, options?: Partial<GatewayRequest>): Promise<unknown> {
    const response = await this.complete({
      ...options,
      jsonMode: true,
      jsonSchema: schema,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.data;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let gatewayInstance: LLMGateway | null = null;

export function getLLMGateway(): LLMGateway {
  if (!gatewayInstance) {
    gatewayInstance = new LLMGateway();
  }
  return gatewayInstance;
}
