/**
 * OWNARA — API Rate Limiter
 *
 * Simple in-memory rate limiter for API routes.
 * Tracks requests per IP address within a sliding window.
 *
 * For V1, this protects auth endpoints (login, signup, refresh) from
 * brute-force attacks. In production behind Cloudflare, Cloudflare's
 * WAF rate limiting rules provide the primary defense — this is the
 * application-level fallback.
 *
 * Usage:
 *   import { checkRateLimit } from "@/lib/rate-limiter";
 *
 *   const result = checkRateLimit(request, { key: "login", limit: 10, windowMs: 60000 });
 *   if (!result.allowed) {
 *     return error("RATE_LIMITED", "Too many attempts. Try again later.", 429);
 *   }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

export interface RateLimitOptions {
  /** Unique key for this rate limit bucket (e.g. "login", "signup") */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): RateLimitResult {
  cleanup();

  // Get client IP from headers (respecting proxy headers)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const bucketKey = `${options.key}:${ip}`;
  const now = Date.now();

  const existing = store.get(bucketKey);

  if (!existing || existing.resetAt < now) {
    // First request or window expired — start fresh
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    store.set(bucketKey, entry);
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  existing.count++;

  if (existing.count > options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Convenience helper for auth endpoints.
 * 10 attempts per minute per IP.
 */
export function checkAuthRateLimit(request: Request): RateLimitResult {
  return checkRateLimit(request, {
    key: "auth",
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  });
}
