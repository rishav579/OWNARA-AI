/**
 * BIHARI AI — LLM Provider Adapters
 *
 * Each adapter implements the LLMProvider interface. The gateway uses whichever
 * adapter is configured via environment variables.
 *
 * Providers:
 * - Mock (deterministic, no API calls — used for development and testing)
 * - OpenAI (GPT-4o, GPT-4o-mini)
 * - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Haiku)
 * - Google Gemini (Gemini 1.5 Pro, Gemini 1.5 Flash)
 * - Ollama (open-weight models running locally)
 *
 * When no API key is configured, the provider is marked unavailable.
 * The model router falls back to the Mock provider.
 */

import { execSync } from "child_process";
import crypto from "crypto";
import type { LLMProvider, LLMRequest, LLMResponse, LLMProviderError } from "../types";

// ─── Cost Tables (per 1M tokens, in cents) ───────────────────────────────────

const COST_TABLES: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    "gpt-4o": { input: 250, output: 1000 },
    "gpt-4o-mini": { input: 15, output: 60 },
    "gpt-4-turbo": { input: 1000, output: 3000 },
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": { input: 300, output: 1500 },
    "claude-3-haiku-20240307": { input: 25, output: 125 },
  },
  gemini: {
    "gemini-1.5-pro": { input: 125, output: 500 },
    "gemini-1.5-flash": { input: 7.5, output: 30 },
  },
  ollama: {
    // Ollama runs locally — cost is effectively zero
    "llama3.1": { input: 0, output: 0 },
    "qwen2.5": { input: 0, output: 0 },
  },
};

function calculateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const table = COST_TABLES[provider]?.[model];
  if (!table) return 0;
  return Math.ceil((promptTokens / 1_000_000) * table.input + (completionTokens / 1_000_000) * table.output);
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function generateExecutionId(): string {
  return `llm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// ─── Mock Provider ────────────────────────────────────────────────────────────

export class MockProvider implements LLMProvider {
  name = "mock";
  displayName = "Mock (Deterministic)";
  available = true;

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const executionId = request.executionId || generateExecutionId();

    // Simulate latency based on content length
    const contentLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const latency = Math.min(3000, Math.max(200, contentLength / 10));

    // Wait to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, Math.min(latency, 500)));

    const promptTokens = request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

    // Generate a deterministic response based on the system prompt
    const systemPrompt = request.messages.find((m) => m.role === "system")?.content || "";
    const userPrompt = request.messages.find((m) => m.role === "user")?.content || "";

    let responseContent: string;

    if (request.jsonMode) {
      // Return a JSON response that matches common schemas
      responseContent = generateMockJsonResponse(systemPrompt, userPrompt);
    } else {
      responseContent = generateMockTextResponse(systemPrompt, userPrompt);
    }

    const completionTokens = estimateTokens(responseContent);

    return {
      content: responseContent,
      model: request.model || "mock-1.0",
      provider: "mock",
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs: Date.now() - start,
      estimatedCostCents: 0,
      executionId,
      cached: false,
    };
  }
}

function generateMockJsonResponse(systemPrompt: string, userPrompt: string): string {
  // If the prompt asks for a plan, return a plan structure
  if (systemPrompt.includes("plan") || userPrompt.includes("plan")) {
    return JSON.stringify({
      reasoning: "Based on the task description, I will break this down into sequential steps.",
      steps: [
        {
          stepType: "reasoning",
          reasoning: "Analyzing the task requirements and available context.",
          confidence: 0.95,
        },
        {
          stepType: "tool_call",
          reasoning: "Searching the knowledge base for relevant information.",
          tool: "search_knowledge",
          toolInput: { query: userPrompt.substring(0, 100) },
          confidence: 0.92,
        },
        {
          stepType: "reasoning",
          reasoning: "Based on the retrieved information, I will draft a response.",
          confidence: 0.90,
        },
      ],
    });
  }

  // If the prompt asks for a recommendation, return a recommendation structure
  if (systemPrompt.includes("recommendation") || systemPrompt.includes("finance")) {
    return JSON.stringify({
      action: "send_first_reminder",
      confidence: 0.92,
      reasoning: "Based on the invoice aging and customer history, a first reminder is recommended.",
    });
  }

  // Default JSON response
  return JSON.stringify({
    reasoning: "Processed the request. The mock provider returns a deterministic response.",
    confidence: 0.85,
  });
}

function generateMockTextResponse(systemPrompt: string, userPrompt: string): string {
  return `[Mock LLM Response]\n\nSystem context: ${systemPrompt.substring(0, 200)}...\n\nUser input: ${userPrompt.substring(0, 200)}...\n\nThis is a deterministic mock response. Configure a real LLM provider (OpenAI, Anthropic, Gemini, Ollama) via environment variables to get real AI responses.`;
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  displayName = "OpenAI";
  available: boolean;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.available = !!this.apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) {
      throw new LLMProviderErrorImpl("openai", "OpenAI API key not configured", 401, false);
    }

    const start = Date.now();
    const executionId = request.executionId || generateExecutionId();
    const model = request.model || "gpt-4o-mini";

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2000,
          response_format: request.jsonMode ? { type: "json_object" } : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LLMProviderErrorImpl(
          "openai",
          `OpenAI API error: ${response.status} ${errorBody.substring(0, 200)}`,
          response.status,
          response.status >= 500
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;

      return {
        content,
        model,
        provider: "openai",
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - start,
        estimatedCostCents: calculateCost("openai", model, promptTokens, completionTokens),
        executionId,
        cached: false,
      };
    } catch (err) {
      if (err instanceof LLMProviderErrorImpl) throw err;
      throw new LLMProviderErrorImpl("openai", `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
    }
  }
}

// ─── Anthropic Claude Provider ───────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  displayName = "Anthropic Claude";
  available: boolean;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.available = !!this.apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) {
      throw new LLMProviderErrorImpl("anthropic", "Anthropic API key not configured", 401, false);
    }

    const start = Date.now();
    const executionId = request.executionId || generateExecutionId();
    const model = request.model || "claude-3-haiku-20240307";

    // Anthropic uses a different message format
    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 2000,
          temperature: request.temperature ?? 0.7,
          system: systemMessage?.content,
          messages: nonSystemMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LLMProviderErrorImpl(
          "anthropic",
          `Anthropic API error: ${response.status} ${errorBody.substring(0, 200)}`,
          response.status,
          response.status >= 500
        );
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "";
      const promptTokens = data.usage?.input_tokens || 0;
      const completionTokens = data.usage?.output_tokens || 0;

      return {
        content,
        model,
        provider: "anthropic",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs: Date.now() - start,
        estimatedCostCents: calculateCost("anthropic", model, promptTokens, completionTokens),
        executionId,
        cached: false,
      };
    } catch (err) {
      if (err instanceof LLMProviderErrorImpl) throw err;
      throw new LLMProviderErrorImpl("anthropic", `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
    }
  }
}

// ─── Google Gemini Provider ──────────────────────────────────────────────────

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  displayName = "Google Gemini";
  available: boolean;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.available = !!this.apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) {
      throw new LLMProviderErrorImpl("gemini", "Gemini API key not configured", 401, false);
    }

    const start = Date.now();
    const executionId = request.executionId || generateExecutionId();
    const model = request.model || "gemini-1.5-flash";

    // Gemini uses a different API format
    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
          contents: nonSystemMessages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2000,
            responseMimeType: request.jsonMode ? "application/json" : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LLMProviderErrorImpl(
          "gemini",
          `Gemini API error: ${response.status} ${errorBody.substring(0, 200)}`,
          response.status,
          response.status >= 500
        );
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const promptTokens = data.usageMetadata?.promptTokenCount || 0;
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

      return {
        content,
        model,
        provider: "gemini",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs: Date.now() - start,
        estimatedCostCents: calculateCost("gemini", model, promptTokens, completionTokens),
        executionId,
        cached: false,
      };
    } catch (err) {
      if (err instanceof LLMProviderErrorImpl) throw err;
      throw new LLMProviderErrorImpl("gemini", `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
    }
  }
}

// ─── Ollama Provider (Open-Weight Models) ────────────────────────────────────

export class OllamaProvider implements LLMProvider {
  name = "ollama";
  displayName = "Ollama (Open-Weight)";
  available: boolean;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.available = process.env.LLM_PROVIDER === "ollama";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) {
      throw new LLMProviderErrorImpl("ollama", "Ollama not configured (set LLM_PROVIDER=ollama)", 401, false);
    }

    const start = Date.now();
    const executionId = request.executionId || generateExecutionId();
    const model = request.model || "llama3.1";

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 2000,
          },
          format: request.jsonMode ? "json" : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new LLMProviderErrorImpl(
          "ollama",
          `Ollama API error: ${response.status} ${errorBody.substring(0, 200)}`,
          response.status,
          response.status >= 500
        );
      }

      const data = await response.json();
      const content = data.message?.content || "";
      const promptTokens = data.prompt_eval_count || estimateTokens(request.messages.map((m) => m.content).join(""));
      const completionTokens = data.eval_count || estimateTokens(content);

      return {
        content,
        model,
        provider: "ollama",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs: Date.now() - start,
        estimatedCostCents: 0, // Ollama runs locally — no cost
        executionId,
        cached: false,
      };
    } catch (err) {
      if (err instanceof LLMProviderErrorImpl) throw err;
      throw new LLMProviderErrorImpl("ollama", `Ollama request failed: ${err instanceof Error ? err.message : String(err)}`, undefined, true);
    }
  }
}

// ─── Provider Registry ───────────────────────────────────────────────────────

/**
 * Returns all provider instances. The model router selects which one to use.
 * The mock provider is always available as a fallback.
 */
export function getProviders(): Record<string, LLMProvider> {
  return {
    mock: new MockProvider(),
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
    gemini: new GeminiProvider(),
    ollama: new OllamaProvider(),
  };
}

// ─── Internal Error Helper ───────────────────────────────────────────────────

class LLMProviderErrorImpl extends Error {
  provider: string;
  statusCode?: number;
  retryable: boolean;

  constructor(provider: string, message: string, statusCode?: number, retryable?: boolean) {
    super(message);
    this.name = "LLMProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
    this.retryable = retryable ?? false;
  }
}
