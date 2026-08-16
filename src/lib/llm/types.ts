/**
 * BIHARI AI — LLM Gateway Types
 *
 * Provider-agnostic types that all providers, the router, the gateway facade,
 * and the executor use. No provider-specific types leak here.
 */

// ─── Request / Response ──────────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Execution ID for tracing through logs and audit */
  executionId?: string;
  /** Task type for routing (planning, reasoning, tool_execution, finance_reasoning) */
  taskType?: string;
  /** Workspace for logging and cost attribution */
  workspaceId?: string;
  /** Employee for logging */
  employeeId?: string;
  /** Task ID for logging */
  taskId?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostCents: number;
  executionId: string;
  cached: boolean;
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface LLMProvider {
  name: string;
  displayName: string;
  available: boolean;

  /**
   * Sends a request to the LLM provider and returns the response.
   * Implementations MUST:
   * - Handle API errors and convert them to LLMProviderError
   * - Measure latency
   * - Count tokens (from API response or estimate)
   * - Calculate estimated cost
   * - Return the raw text content (not parsed)
   */
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class LLMProviderError extends Error {
  provider: string;
  statusCode?: number;
  retryable: boolean;

  constructor(provider: string, message: string, statusCode?: number, retryable?: boolean) {
    super(message);
    this.name = "LLMProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryable = retryable ?? (statusCode ? statusCode >= 500 : false);
  }
}

export class LLMGuardrailError extends Error {
  violation: string;
  detail: string;

  constructor(violation: string, detail: string) {
    super(`Guardrail violation: ${violation} — ${detail}`);
    this.name = "LLMGuardrailError";
    this.violation = violation;
    this.detail = detail;
  }
}

export class LLMValidationError extends Error {
  field: string;
  detail: string;

  constructor(field: string, detail: string) {
    super(`Validation error: ${field} — ${detail}`);
    this.name = "LLMValidationError";
    this.field = field;
    this.detail = detail;
  }
}

// ─── Model Router ────────────────────────────────────────────────────────────

export type TaskType =
  | "planning"
  | "reasoning"
  | "tool_execution"
  | "finance_reasoning"
  | "summarization"
  | "drafting"
  | "general";

export interface ModelRoute {
  taskType: TaskType;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ─── Prompt Registry ─────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  version: number;
  name: string;
  description: string;
  taskType: TaskType;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  jsonSchema?: Record<string, unknown>;
  createdAt: Date;
  active: boolean;
}

export interface PromptInvocation {
  promptId: string;
  version: number;
  variables: Record<string, string>;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export interface LLMLogEntry {
  executionId: string;
  workspaceId?: string;
  employeeId?: string;
  taskId?: string;
  provider: string;
  model: string;
  taskType?: string;
  promptId?: string;
  promptVersion?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
  latencyMs: number;
  cached: boolean;
  success: boolean;
  errorMessage?: string;
  guardrailViolations?: string[];
  createdAt: Date;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  response: LLMResponse;
  createdAt: Date;
  hitCount: number;
}
