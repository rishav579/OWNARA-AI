/**
 * BIHARI AI — LLM Gateway (Provider-Agnostic with Automatic Failover)
 *
 * The single entry point for all LLM calls in the system. Combines:
 * - Model routing (selects provider + model based on task type)
 * - Automatic failover (Gemini → OpenAI → Anthropic → Ollama → Mock)
 * - Prompt registry (loads, versions, and renders prompt templates)
 * - Input guardrails (injection, unsafe tools, missing fields, policy)
 * - Output guardrails (forbidden content, approval bypass)
 * - JSON validation + auto-repair with one retry
 * - Response caching
 * - Structured logging (provider, model, latency, retries, failover, cache)
 *
 * Usage (unchanged from previous version):
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
 * The existing runtime (executor, planner, finance-planner, brain) does NOT
 * need to change — the gateway interface is identical.
 */

import crypto from "crypto";
import type { LLMRequest, LLMResponse, TaskType } from "./types";
import { LLMProviderError as ProviderError, LLMGuardrailError } from "./types";
import { getModelRouter } from "./providers/router";
import { getPromptRegistry, type PromptInvocation } from "./prompts/registry";
import { getResponseCache } from "./cache";
import { logLLMCall } from "./logger";
import { checkInputGuardrails, checkOutputGuardrails } from "./guardrails";
import { validateJsonResponse } from "./validator";

// ─── Gateway Request (unchanged interface) ───────────────────────────────────

export interface GatewayRequest {
  taskType?: TaskType;
  promptId?: string;
  variables?: Record<string, string>;
  messages?: { role: "system" | "user" | "assistant"; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  jsonSchema?: Record<string, unknown>;
  workspaceId?: string;
  employeeId?: string;
  taskId?: string;
  useCache?: boolean;
}

export interface GatewayResponse {
  content: string;
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
  repaired: boolean;
  promptId?: string;
  promptVersion?: number;
  /** Number of failover attempts before success (0 = primary succeeded) */
  failoverCount?: number;
  /** Which provider was tried first */
  primaryProvider?: string;
  /** Which provider actually served the request */
  servedBy?: string;
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

export class LLMGateway {
  /**
   * Executes an LLM call through the full gateway pipeline with failover.
   *
   * Pipeline:
   * 1. Load prompt template (if promptId is provided)
   * 2. Render prompt with variables
   * 3. Check input guardrails
   * 4. Check cache
   * 5. Route to provider with failover chain
   * 6. Execute LLM call (try each provider in the failover chain)
   * 7. Check output guardrails
   * 8. Validate JSON (if jsonMode) — retry once with repair prompt if invalid
   * 9. Log the call with structured metadata
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
        version: 0,
        variables: request.variables,
      };

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
      await logLLMCall(llmRequest, null, "Input guardrail violation", guardrailViolations, promptId, promptVersion);
      throw new LLMGuardrailError("input_guardrail", inputCheck.violations.join("; "));
    }

    // ─── Step 4: Check cache ────────────────────────────────────────────────
    const router = getModelRouter();
    const failoverChain = router.routeWithFailover(taskType);
    const primaryRoute = failoverChain[0]?.route;
    const primaryProvider = failoverChain[0]?.provider.name || "unknown";

    const model = request.model || primaryRoute?.model || "gemini-3.6-flash";
    const temperature = request.temperature ?? primaryRoute?.temperature ?? 0.5;
    const maxTokens = request.maxTokens ?? primaryRoute?.maxTokens ?? 2000;

    const cache = getResponseCache();
    const cacheKey = cache.key(messages, model, temperature, promptId, promptVersion);

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        let data: unknown | null = null;
        let repaired = false;
        if (request.jsonMode) {
          const validation = validateJsonResponse(cached.content, request.jsonSchema);
          data = validation.data;
          repaired = validation.repaired;
        }

        console.log(`[LLM] ✓ CACHE HIT | ${cached.provider}/${cached.model} | ${taskType} | ${cached.latencyMs}ms | exec=${executionId}`);

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
          failoverCount: 0,
          primaryProvider,
          servedBy: cached.provider,
        };
      }
    }

    // ─── Step 5+6: Route to provider with failover ──────────────────────────
    let llmResponse: LLMResponse | null = null;
    let failoverCount = 0;
    const attemptedProviders: string[] = [];
    const failoverReasons: string[] = [];

    for (const entry of failoverChain) {
      const providerName = entry.provider.name;
      attemptedProviders.push(providerName);

      // Determine the model for this provider
      const providerModel = entry.route.model || model;

      // Retry logic within a single provider (transient failures)
      const maxRetries = 2;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          const startMs = Date.now();
          // Timeout: 30 seconds per provider call
          const timeoutMs = 30000;
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

          try {
            llmResponse = await Promise.race([
              entry.provider.complete({
                ...llmRequest,
                model: providerModel,
                temperature,
                maxTokens,
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Provider ${providerName} timed out after ${timeoutMs}ms`)), timeoutMs)
              ),
            ]);
          } finally {
            clearTimeout(timeoutId);
          }
          const elapsedMs = Date.now() - startMs;

          // Structured logging for successful call
          console.log(
            `[LLM] ✓ ${providerName}/${providerModel} | ${taskType} | ` +
            `${llmResponse.totalTokens} tokens | ${elapsedMs}ms | ` +
            `₹${(llmResponse.estimatedCostCents / 100).toFixed(4)}` +
            (llmResponse.cached ? " (cached)" : "") +
            (failoverCount > 0 ? ` | failover #${failoverCount} from ${primaryProvider}` : "") +
            ` | exec=${executionId}` +
            (request.workspaceId ? ` | ws=${request.workspaceId.slice(-8)}` : "")
          );

          break; // Success — exit retry loop
        } catch (err) {
          const isProviderError = err instanceof ProviderError || (err as any)?.name === "LLMProviderError";
          const retryable = isProviderError ? (err as any)?.retryable : false;
          // Network errors (TypeError: fetch failed) are also retryable
          const isNetworkError = !isProviderError && (err instanceof TypeError || (err instanceof Error && err.message.includes("fetch")));

          if ((retryable || isNetworkError) && retryCount < maxRetries) {
            retryCount++;
            const backoff = Math.pow(2, retryCount) * 1000;
            console.log(
              `[LLM] ↻ RETRY ${providerName} in ${backoff}ms (attempt ${retryCount}/${maxRetries}) | ` +
              `task=${taskType} | exec=${executionId} | error: ${err instanceof Error ? err.message : String(err)}`
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }

          // Provider failed permanently — log and try next provider in failover chain
          const errorMsg = err instanceof Error ? err.message : String(err);
          failoverReasons.push(`${providerName}: ${errorMsg}`);

          console.log(
            `[LLM] ✗ ${providerName} FAILED | task=${taskType} | exec=${executionId} | ` +
            `error: ${errorMsg} | retries: ${retryCount}`
          );

          // Log the failed attempt
          await logLLMCall(
            { ...llmRequest, model: providerModel },
            null,
            `${providerName} error: ${errorMsg}`,
            guardrailViolations.length > 0 ? guardrailViolations : null,
            promptId,
            promptVersion,
          );

          break; // Exit retry loop — move to next provider
        }
      }

      if (llmResponse) break; // Success — exit failover loop

      failoverCount++;
    }

    // ─── If all providers failed (including mock), throw ─────────────────────
    if (!llmResponse) {
      const allErrors = failoverReasons.join("; ");
      console.error(
        `[LLM] ✗✗✗ ALL PROVIDERS FAILED | task=${taskType} | exec=${executionId} | ` +
        `attempted: ${attemptedProviders.join(" → ")} | errors: ${allErrors}`
      );
      await logLLMCall(llmRequest, null, `All providers failed: ${allErrors}`, guardrailViolations.length > 0 ? guardrailViolations : null, promptId, promptVersion);
      throw new Error(`All LLM providers failed. Attempted: ${attemptedProviders.join(" → ")}. Errors: ${allErrors}`);
    }

    // ─── Step 7: Output guardrails ──────────────────────────────────────────
    const outputCheck = checkOutputGuardrails(llmResponse.content);
    if (!outputCheck.passed) {
      guardrailViolations = outputCheck.violations;
      await logLLMCall(llmRequest, llmResponse, "Output guardrail violation", guardrailViolations, promptId, promptVersion);
      throw new LLMGuardrailError("output_guardrail", outputCheck.violations.join("; "));
    }

    // ─── Step 8: Validate JSON (if jsonMode) with repair retry ──────────────
    let data: unknown | null = null;
    let repaired = false;

    if (request.jsonMode) {
      const validation = validateJsonResponse(llmResponse.content, request.jsonSchema);

      if (!validation.valid) {
        // ─── JSON Repair Retry: try once with a repair prompt ───────────────
        console.log(
          `[LLM] ⚠ JSON INVALID from ${llmResponse.provider} | task=${taskType} | exec=${executionId} | ` +
          `error: ${validation.error} | attempting repair...`
        );

        // Build a repair prompt
        const repairMessages = [
          ...messages,
          { role: "assistant" as const, content: llmResponse.content },
          {
            role: "user" as const,
            content: `The previous response was not valid JSON. Error: ${validation.error}\n\nPlease return ONLY valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema || {}, null, 2)}`,
          },
        ];

        // Try repair with the same provider (no failover for repair — it's a quick fix)
        try {
          const repairResponse = await failoverChain[0].provider.complete({
            ...llmRequest,
            messages: repairMessages,
            model: failoverChain[0].route.model || model,
            temperature: 0.1, // Low temperature for repair
            maxTokens,
          });

          const repairValidation = validateJsonResponse(repairResponse.content, request.jsonSchema);
          if (repairValidation.valid) {
            // Repair succeeded — use the repaired response
            console.log(`[LLM] ✓ JSON REPAIRED | task=${taskType} | exec=${executionId}`);
            llmResponse = repairResponse;
            data = repairValidation.data;
            repaired = true;
          } else {
            // Repair also failed — log and return structured error
            console.log(
              `[LLM] ✗ JSON REPAIR FAILED | task=${taskType} | exec=${executionId} | ` +
              `error: ${repairValidation.error}`
            );
            await logLLMCall(
              llmRequest,
              llmResponse,
              `JSON validation failed (repair also failed): ${repairValidation.error}`,
              guardrailViolations.length > 0 ? guardrailViolations : null,
              promptId,
              promptVersion,
            );
            data = null;
          }
        } catch (repairErr) {
          // Repair call itself failed — return structured error
          console.log(
            `[LLM] ✗ JSON REPAIR ERROR | task=${taskType} | exec=${executionId} | ` +
            `error: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`
          );
          data = null;
        }
      } else {
        data = validation.data;
        repaired = validation.repaired;
      }
    }

    // ─── Step 9: Log ────────────────────────────────────────────────────────
    await logLLMCall(llmRequest, llmResponse, null, null, promptId, promptVersion);

    // ─── Step 10: Cache (only if JSON is valid or not in jsonMode) ──────────
    if (useCache && (data !== null || !request.jsonMode)) {
      cache.set(cacheKey, llmResponse);
    }

    // ─── Step 11: Return ────────────────────────────────────────────────────
    return {
      content: llmResponse.content,
      data,
      model: llmResponse.model,
      provider: llmResponse.provider,
      promptTokens: llmResponse.promptTokens,
      completionTokens: llmResponse.completionTokens,
      totalTokens: llmResponse.totalTokens,
      latencyMs: llmResponse.latencyMs,
      estimatedCostCents: llmResponse.estimatedCostCents,
      executionId: llmResponse.executionId,
      cached: false,
      repaired,
      promptId,
      promptVersion,
      failoverCount,
      primaryProvider,
      servedBy: llmResponse.provider,
    };
  }

  /**
   * Convenience method for simple text completion.
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
