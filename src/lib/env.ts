/**
 * BIHARI AI — Environment Validation
 *
 * Validates critical environment variables at startup.
 * In production, missing required variables cause a hard failure.
 * In development, sensible defaults are used.
 *
 * This module is imported by db.ts and auth.ts to ensure validation
 * runs before any database or auth operation.
 */

export interface EnvValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  isProduction: boolean;
  provider: "sqlite" | "postgresql";
}

let cached: EnvValidation | null = null;

export function validateEnv(): EnvValidation {
  if (cached) return cached;

  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";
  const dbUrl = process.env.DATABASE_URL || "";

  let provider: "sqlite" | "postgresql" = "sqlite";
  if (dbUrl.startsWith("file:")) provider = "sqlite";
  else if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))
    provider = "postgresql";

  // ─── REQUIRED in all environments ────────────────────────────────────────
  if (!dbUrl) {
    errors.push("DATABASE_URL is not set");
  }

  // ─── REQUIRED in production ──────────────────────────────────────────────
  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "build-time-placeholder" || process.env.JWT_SECRET.length < 32) {
      errors.push("JWT_SECRET must be set to a string of at least 32 characters in production");
    }

    if (provider === "sqlite") {
      errors.push("SQLite is not supported in production. Set DATABASE_URL to a PostgreSQL connection string and change provider to 'postgresql' in prisma/schema.prisma");
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      warnings.push("SMTP is not configured. Email will use MOCK TRANSPORT (status: sent_mock). Production should configure real SMTP.");
    }

    if (!process.env.SMTP_FROM) {
      warnings.push("SMTP_FROM is not set. Will default to noreply@bihari.ai");
    }
  }

  // ─── Warnings (non-blocking) ─────────────────────────────────────────────
  if (!isProduction) {
    if (!process.env.JWT_SECRET) {
      warnings.push("JWT_SECRET not set — using dev-only secret. Do NOT use in production.");
    }
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      warnings.push("No LLM API key configured. Using MOCK LLM provider (deterministic fallback).");
    }
    if (!process.env.SMTP_HOST) {
      warnings.push("SMTP_HOST not set. Email will use MOCK TRANSPORT.");
    }
  }

  cached = {
    valid: errors.length === 0,
    errors,
    warnings,
    isProduction,
    provider,
  };

  // Log warnings at startup
  if (warnings.length > 0) {
    console.log("[Env] Warnings:");
    warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  }

  // Hard fail on errors in production — but only at runtime, not during build
  // (Next.js runs with NODE_ENV=production during build, but env vars aren't
  // available yet. The build doesn't need DB/JWT — only runtime does.)
  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    Boolean(process.env.NEXT_BUILD_PHASE);

  if (errors.length > 0 && isProduction && !isBuildPhase) {
    console.error("[Env] CRITICAL ERRORS — application cannot start safely in production:");
    errors.forEach((e) => console.error(`  ❌ ${e}`));
    throw new Error(`Environment validation failed: ${errors.join("; ")}`);
  }

  return cached;
}
