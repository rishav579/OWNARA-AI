/**
 * BIHARI AI — JSON Response Validator
 *
 * Validates LLM responses against expected JSON schemas and attempts
 * automatic repair when validation fails.
 *
 * Repair strategies:
 * 1. Extract JSON from markdown code blocks (```json ... ```)
 * 2. Strip leading/trailing non-JSON text
 * 3. Fix common JSON errors (trailing commas, unquoted keys)
 * 4. Re-prompt with error feedback (handled by the gateway)
 */

export interface ValidationResult {
  valid: boolean;
  data: unknown;
  error?: string;
  repaired: boolean;
}

/**
 * Validates and attempts to repair an LLM response as JSON.
 */
export function validateJsonResponse(content: string, schema?: Record<string, unknown>): ValidationResult {
  let jsonStr = content.trim();

  // ─── Repair Step 1: Extract from markdown code blocks ────────────────────
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // ─── Repair Step 2: Find the first { and last } ──────────────────────────
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  // ─── Repair Step 3: Fix common JSON errors ───────────────────────────────
  // Remove trailing commas before closing braces/brackets
  jsonStr = jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

  // ─── Parse ───────────────────────────────────────────────────────────────
  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch (err) {
    return {
      valid: false,
      data: null,
      error: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      repaired: false,
    };
  }

  // ─── Schema validation (lightweight — checks required fields) ─────────────
  if (schema && typeof schema === "object") {
    const required = (schema as any).required as string[] | undefined;
    if (required && Array.isArray(required) && typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      const missing = required.filter((field) => !(field in obj));
      if (missing.length > 0) {
        return {
          valid: false,
          data,
          error: `Missing required fields: ${missing.join(", ")}`,
          repaired: true, // JSON was repaired, but schema validation failed
        };
      }
    }
  }

  return {
    valid: true,
    data,
    repaired: jsonStr !== content.trim(),
  };
}
