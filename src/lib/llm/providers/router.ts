/**
 * BIHARI AI — Model Router (Provider-Agnostic, Gemini-First)
 *
 * Selects the best provider + model for a given task type.
 *
 * Routing logic:
 * 1. If LLM_PROVIDER is set explicitly, use that provider for all tasks
 * 2. If LLM_MODEL is set, use that specific model
 * 3. Otherwise, use the task-type-based routing table below
 * 4. If the selected provider is unavailable, walk the failover chain
 *
 * Failover chain (in priority order):
 *   Gemini → OpenAI → Anthropic → Ollama → Mock
 *
 * Gemini is the default because the platform ships with Google AI Pro.
 * No provider is hardcoded as the only option — the system is provider-agnostic.
 *
 * The router checks provider availability dynamically at construction time.
 * The gateway calls routeWithFailover() at call time to get the full chain.
 */

import type { LLMProvider, ModelRoute, TaskType } from "../types";
import { getProviders } from "./adapters";

// ─── Failover Chain ──────────────────────────────────────────────────────────

/**
 * The order in which providers are tried when the primary is unavailable
 * or fails. Mock is always last — it never fails but produces deterministic
 * (non-AI) output.
 */
export const FAILOVER_CHAIN = [
  "gemini",
  "openai",
  "anthropic",
  "ollama",
  "mock",
] as const;

// ─── Default Routing Table (Gemini-first) ────────────────────────────────────

/**
 * Each task type specifies a preferred provider, model, temperature, and
 * maxTokens. The provider field is the PREFERRED provider — if it's not
 * available, the gateway walks the failover chain.
 *
 * Gemini models are the default. OpenAI/Anthropic models are listed as
 * fallbacks in the route so the gateway knows which model to use for each
 * provider in the failover chain.
 */
const DEFAULT_ROUTES: Record<TaskType, ModelRoute> = {
  planning: {
    taskType: "planning",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.3,
    maxTokens: 2000,
  },
  reasoning: {
    taskType: "reasoning",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.5,
    maxTokens: 1500,
  },
  tool_execution: {
    taskType: "tool_execution",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.2,
    maxTokens: 1000,
  },
  finance_reasoning: {
    taskType: "finance_reasoning",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.3,
    maxTokens: 2000,
  },
  summarization: {
    taskType: "summarization",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.3,
    maxTokens: 1000,
  },
  drafting: {
    taskType: "drafting",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.7,
    maxTokens: 2000,
  },
  general: {
    taskType: "general",
    provider: "gemini",
    model: "gemini-3.6-flash",
    temperature: 0.5,
    maxTokens: 1500,
  },
};

// ─── Fallback models per provider ────────────────────────────────────────────

/**
 * When failover occurs, the gateway needs to know which model to use for
 * the fallback provider. This map provides a sensible default model for
 * each provider + task type combination.
 */
const FALLBACK_MODELS: Record<string, Record<TaskType, string>> = {
  openai: {
    planning: "gpt-4o-mini",
    reasoning: "gpt-4o-mini",
    tool_execution: "gpt-4o-mini",
    finance_reasoning: "gpt-4o",
    summarization: "gpt-4o-mini",
    drafting: "gpt-4o",
    general: "gpt-4o-mini",
  },
  anthropic: {
    planning: "claude-3-haiku-20240307",
    reasoning: "claude-3-haiku-20240307",
    tool_execution: "claude-3-haiku-20240307",
    finance_reasoning: "claude-3-5-sonnet-20241022",
    summarization: "claude-3-haiku-20240307",
    drafting: "claude-3-5-sonnet-20241022",
    general: "claude-3-haiku-20240307",
  },
  ollama: {
    planning: "llama3.1",
    reasoning: "llama3.1",
    tool_execution: "llama3.1",
    finance_reasoning: "llama3.1",
    summarization: "llama3.1",
    drafting: "llama3.1",
    general: "llama3.1",
  },
  mock: {
    planning: "mock-1.0",
    reasoning: "mock-1.0",
    tool_execution: "mock-1.0",
    finance_reasoning: "mock-1.0",
    summarization: "mock-1.0",
    drafting: "mock-1.0",
    general: "mock-1.0",
  },
  gemini: {
    planning: "gemini-3.6-flash",
    reasoning: "gemini-3.6-flash",
    tool_execution: "gemini-3.6-flash",
    finance_reasoning: "gemini-3.6-flash",
    summarization: "gemini-3.6-flash",
    drafting: "gemini-3.6-flash",
    general: "gemini-3.6-flash",
  },
};

// ─── Router ──────────────────────────────────────────────────────────────────

export class ModelRouter {
  private providers: Record<string, LLMProvider>;
  private routes: Record<TaskType, ModelRoute>;
  private forcedProvider: string | null;
  private forcedModel: string | null;

  constructor() {
    this.providers = getProviders();
    this.routes = { ...DEFAULT_ROUTES };

    // Check for forced provider/model via env
    this.forcedProvider = process.env.LLM_PROVIDER || null;
    this.forcedModel = process.env.LLM_MODEL || null;

    // If a forced provider is set and available, override all routes
    if (this.forcedProvider && this.forcedProvider !== "mock") {
      const provider = this.providers[this.forcedProvider];
      if (provider && provider.available) {
        for (const taskType of Object.keys(this.routes) as TaskType[]) {
          this.routes[taskType] = {
            ...this.routes[taskType],
            provider: this.forcedProvider,
            model: this.forcedModel || this.routes[taskType].model,
          };
        }
      }
    }
  }

  /**
   * Returns the preferred provider and route for a given task type.
   * Does NOT walk the failover chain — use routeWithFailover() for that.
   * Kept for backward compatibility with code that calls route().
   */
  route(taskType: TaskType): { provider: LLMProvider; route: ModelRoute } {
    const route = this.routes[taskType] || this.routes.general;
    let provider = this.providers[route.provider];

    // If the preferred provider is not available, find the first available
    if (!provider || !provider.available) {
      for (const name of FAILOVER_CHAIN) {
        const candidate = this.providers[name];
        if (candidate && candidate.available) {
          provider = candidate;
          return {
            provider,
            route: {
              ...route,
              provider: name,
              model: this.getModelForProvider(name, taskType),
            },
          };
        }
      }
      // Should never reach here since mock is always available
      provider = this.providers.mock;
      return {
        provider,
        route: { ...route, provider: "mock", model: "mock-1.0" },
      };
    }

    return { provider, route };
  }

  /**
   * Re-checks provider availability at call time by reading process.env.
   * This allows runtime key rotation without restarting the process.
   */
  private isProviderAvailable(name: string): boolean {
    switch (name) {
      case "gemini": return !!process.env.GEMINI_API_KEY;
      case "openai": return !!process.env.OPENAI_API_KEY;
      case "anthropic": return !!process.env.ANTHROPIC_API_KEY;
      case "ollama": return process.env.LLM_PROVIDER === "ollama";
      case "mock": return true; // Always available
      default: return false;
    }
  }

  /**
   * Returns the ordered list of (provider, route) pairs to try for a given
   * task type. The gateway iterates this list, trying each provider in turn
   * until one succeeds.
   *
   * Availability is checked at CALL TIME (not init time) so runtime key
   * changes are respected.
   *
   * Mock is always included as the last entry.
   */
  routeWithFailover(taskType: TaskType): Array<{ provider: LLMProvider; route: ModelRoute; failoverReason?: string }> {
    const route = this.routes[taskType] || this.routes.general;
    const result: Array<{ provider: LLMProvider; route: ModelRoute; failoverReason?: string }> = [];

    // Check if the preferred provider from the routing table is available
    const preferredName = route.provider;
    const preferredAvailable = this.isProviderAvailable(preferredName);

    if (preferredAvailable) {
      const provider = this.providers[preferredName];
      if (provider) {
        result.push({
          provider,
          route: { ...route, provider: preferredName },
        });
      }
    }

    // Walk the failover chain, adding available providers not already included
    for (const name of FAILOVER_CHAIN) {
      if (name === preferredName) continue;
      if (!this.isProviderAvailable(name)) continue;
      const candidate = this.providers[name];
      if (!candidate) continue;
      if (result.some((r) => r.provider.name === candidate.name)) continue;

      result.push({
        provider: candidate,
        route: {
          ...route,
          provider: name,
          model: this.getModelForProvider(name, taskType),
        },
        failoverReason: preferredAvailable ? `${preferredName} failed` : `${preferredName} unavailable`,
      });
    }

    // Ensure mock is always last (it's always available)
    if (!result.some((r) => r.provider.name === "mock")) {
      result.push({
        provider: this.providers.mock,
        route: { ...route, provider: "mock", model: "mock-1.0" },
        failoverReason: "all real providers exhausted",
      });
    }

    return result;
  }

  /**
   * Returns the model name to use for a given provider and task type.
   * Falls back to the provider's default model, then to "mock-1.0".
   */
  private getModelForProvider(providerName: string, taskType: TaskType): string {
    const models = FALLBACK_MODELS[providerName];
    if (models && models[taskType]) {
      return models[taskType];
    }
    // Fall back to the forced model or a generic default
    return this.forcedModel || "gemini-3.6-flash";
  }

  /**
   * Returns a specific provider by name (for direct use).
   */
  getProvider(name: string): LLMProvider | null {
    const provider = this.providers[name];
    return provider && provider.available ? provider : null;
  }

  /**
   * Returns all available providers.
   */
  getAvailableProviders(): LLMProvider[] {
    return Object.values(this.providers).filter((p) => p.available);
  }

  /**
   * Returns the failover chain as a list of provider names (for logging).
   */
  getFailoverChain(): string[] {
    return FAILOVER_CHAIN.filter((name) => {
      const p = this.providers[name];
      return p && p.available;
    });
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let routerInstance: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!routerInstance) {
    routerInstance = new ModelRouter();
  }
  return routerInstance;
}
