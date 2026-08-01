/**
 * BIHARI AI — Model Router
 *
 * Selects the best provider + model for a given task type.
 *
 * Routing logic:
 * 1. If LLM_PROVIDER is set explicitly, use that provider for all tasks
 * 2. If LLM_MODEL is set, use that specific model
 * 3. Otherwise, use the task-type-based routing table below
 * 4. If the selected provider is unavailable, fall back to Mock
 *
 * The router checks provider availability at call time, so if an API key
 * is removed or a local Ollama instance goes down, it gracefully degrades.
 */

import type { LLMProvider, ModelRoute, TaskType } from "../types";
import { getProviders } from "./adapters";

// ─── Default Routing Table ───────────────────────────────────────────────────

const DEFAULT_ROUTES: Record<TaskType, ModelRoute> = {
  planning: {
    taskType: "planning",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2000,
  },
  reasoning: {
    taskType: "reasoning",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 1500,
  },
  tool_execution: {
    taskType: "tool_execution",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1000,
  },
  finance_reasoning: {
    taskType: "finance_reasoning",
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.3,
    maxTokens: 2000,
  },
  summarization: {
    taskType: "summarization",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 1000,
  },
  drafting: {
    taskType: "drafting",
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 2000,
  },
  general: {
    taskType: "general",
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 1500,
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

    // If a forced provider is set, override all routes to use it
    if (this.forcedProvider && this.forcedProvider !== "mock") {
      const provider = this.providers[this.forcedProvider];
      if (provider && provider.available) {
        // Override all routes to use the forced provider
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
   * Returns the provider and route for a given task type.
   * Falls back to Mock if the selected provider is unavailable.
   */
  route(taskType: TaskType): { provider: LLMProvider; route: ModelRoute } {
    const route = this.routes[taskType] || this.routes.general;
    let provider = this.providers[route.provider];

    // If the selected provider is not available, fall back to Mock
    if (!provider || !provider.available) {
      provider = this.providers.mock;
      return {
        provider,
        route: {
          ...route,
          provider: "mock",
          model: provider.name === "mock" ? "mock-1.0" : route.model,
        },
      };
    }

    return { provider, route };
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
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let routerInstance: ModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (!routerInstance) {
    routerInstance = new ModelRouter();
  }
  return routerInstance;
}
