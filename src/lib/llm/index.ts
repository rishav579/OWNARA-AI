/**
 * BIHARI AI — LLM Gateway Barrel Export
 *
 * Single import point for all LLM gateway functionality.
 *
 * Usage:
 *   import { getLLMGateway, type GatewayRequest, type GatewayResponse } from "@/lib/llm";
 *   const gateway = getLLMGateway();
 *   const response = await gateway.complete({ ... });
 */

export { getLLMGateway, LLMGateway, type GatewayRequest, type GatewayResponse } from "./gateway";
export { getPromptRegistry, PromptRegistry, type PromptInvocation } from "./prompts/registry";
export { getModelRouter, ModelRouter } from "./providers/router";
export { getResponseCache, ResponseCache } from "./cache";
export { logLLMCall } from "./logger";
export { checkInputGuardrails, checkOutputGuardrails, checkPolicyCompliance, type GuardrailResult } from "./guardrails";
export { validateJsonResponse, type ValidationResult } from "./validator";
export type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  TaskType,
  ModelRoute,
  PromptTemplate,
  LLMLogEntry,
  LLMProviderError,
  LLMGuardrailError,
  LLMValidationError,
} from "./types";
export { MockProvider, OpenAIProvider, AnthropicProvider, GeminiProvider, OllamaProvider, getProviders } from "./providers/adapters";
