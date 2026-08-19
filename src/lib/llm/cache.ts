/**
 * OWNARA — LLM Response Cache
 *
 * Caches LLM responses for identical prompt + context combinations.
 * This avoids redundant API calls when the same prompt is sent multiple
 * times with the same context (e.g., planning a similar task).
 *
 * The cache is in-memory with a configurable TTL. It is per-process —
 * in a multi-worker setup, each worker has its own cache. This is
 * acceptable for V1 (the cache hit rate is low for unique tasks).
 *
 * Cache key: SHA-256 of (systemPrompt + userPrompt + model + temperature)
 */

import crypto from "crypto";
import type { LLMResponse, CacheEntry } from "./types";

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxEntries: number;

  constructor(ttlMinutes: number = 30, maxEntries: number = 100) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.maxEntries = maxEntries;
  }

  /**
   * Generates a cache key from the request parameters.
   * Includes model + temperature so different providers/models don't collide.
   * The provider is implied by the model name (e.g., "gemini-3.6-flash" ≠ "gpt-4o-mini").
   */
  key(messages: { role: string; content: string }[], model: string, temperature: number, promptId?: string, promptVersion?: number): string {
    const content = messages.map((m) => `${m.role}:${m.content}`).join("|");
    const promptKey = promptId ? `${promptId}:${promptVersion || 0}` : "";
    return crypto.createHash("sha256").update(`${content}|${model}|${temperature}|${promptKey}`).digest("hex");
  }

  /**
   * Gets a cached response if it exists and is not expired.
   */
  get(key: string): LLMResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.createdAt.getTime();
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;
    return { ...entry.response, cached: true };
  }

  /**
   * Stores a response in the cache.
   */
  set(key: string, response: LLMResponse): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      response: { ...response, cached: false },
      createdAt: new Date(),
      hitCount: 0,
    });
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns cache statistics.
   */
  stats(): { entries: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }
    return {
      entries: this.cache.size,
      hitRate: this.cache.size > 0 ? totalHits / (totalHits + this.cache.size) : 0,
    };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let cacheInstance: ResponseCache | null = null;

export function getResponseCache(): ResponseCache {
  if (!cacheInstance) {
    const ttlMinutes = parseInt(process.env.LLM_CACHE_TTL_MINUTES || "30");
    cacheInstance = new ResponseCache(ttlMinutes);
  }
  return cacheInstance;
}
