/**
 * OWNARA — LLM Guardrails
 *
 * Input and output safety checks that run BEFORE and AFTER every LLM call.
 *
 * Input guardrails (run before LLM call):
 * - Prompt injection detection (user content that tries to override system instructions)
 * - Unsafe tool use detection (tools not in the employee's whitelist)
 * - Missing required fields (critical context missing from the prompt)
 * - Policy violation detection (content that violates company policies)
 *
 * Output guardrails (run after LLM call):
 * - Response contains forbidden content (PII leakage, internal system info)
 * - Response tries to execute unauthorized tools
 * - Response contains instructions that bypass the approval gate
 *
 * If a guardrail is violated, the gateway raises an LLMGuardrailError and
 * the call is aborted. The error is logged and the employee's task fails
 * gracefully.
 */

import type { LLMRequest, LLMGuardrailError } from "./types";
import { LLMGuardrailError as GuardrailError } from "./types";

// ─── Input Guardrails ────────────────────────────────────────────────────────

/**
 * Patterns that indicate prompt injection attempts.
 * These are checked against user-provided content (not system prompts).
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+(now|actually)\s+a/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /reveal\s+(your|the)\s+(system|hidden)\s+(prompt|instructions)/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+(different|jailbreak)/i,
  /execute\s+(shell|system|os)\s+command/i,
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /file:\/\/\//i,
  /etc\/passwd/i,
  /curl\s+http/i,
  /wget\s+http/i,
];

/**
 * Tools that are NEVER allowed (regardless of employee configuration).
 */
const FORBIDDEN_TOOLS = [
  "execute_shell",
  "run_code",
  "eval",
  "exec",
  "system",
  "subprocess",
  "file_write",
  "file_delete",
  "database_query",
];

/**
 * Fields that must not appear in LLM output (PII / sensitive data).
 */
const FORBIDDEN_OUTPUT_PATTERNS = [
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /private[_-]?key/i,
  /jwt\s+token/i,
];

export interface GuardrailResult {
  passed: boolean;
  violations: string[];
}

/**
 * Runs all input guardrails on an LLM request.
 * Returns { passed: true } if all checks pass, or { passed: false, violations: [...] }.
 */
export function checkInputGuardrails(request: LLMRequest): GuardrailResult {
  const violations: string[] = [];

  // ─── Prompt Injection Detection ──────────────────────────────────────────
  for (const message of request.messages) {
    if (message.role === "system") continue; // System prompts are trusted

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(message.content)) {
        violations.push(`prompt_injection: Detected pattern "${pattern.source}" in ${message.role} message`);
      }
    }
  }

  // ─── Unsafe Tool Use Detection ───────────────────────────────────────────
  // Check if the prompt references forbidden tools (word-boundary match to
  // avoid false positives like "exec" matching "execute")
  const allContent = request.messages.map((m) => m.content).join(" ");
  for (const tool of FORBIDDEN_TOOLS) {
    const toolPattern = new RegExp(`\\b${tool}\\b`, "i");
    if (toolPattern.test(allContent)) {
      violations.push(`unsafe_tool: Reference to forbidden tool "${tool}" detected`);
    }
  }

  // ─── Missing Required Fields ─────────────────────────────────────────────
  // Check that the user prompt contains some content (not empty)
  const userMessage = request.messages.find((m) => m.role === "user");
  if (!userMessage || userMessage.content.trim().length < 10) {
    violations.push("missing_fields: User message is empty or too short (minimum 10 characters)");
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Runs all output guardrails on an LLM response.
 * Returns { passed: true } if all checks pass, or { passed: false, violations: [...] }.
 */
export function checkOutputGuardrails(content: string): GuardrailResult {
  const violations: string[] = [];

  // ─── Forbidden Output Detection ──────────────────────────────────────────
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`forbidden_output: Detected sensitive data pattern "${pattern.source}" in response`);
    }
  }

  // ─── Approval Bypass Detection ───────────────────────────────────────────
  // Check if the response tries to bypass the approval gate
  const bypassPatterns = [
    /auto[_-]?approve/i,
    /skip\s+approval/i,
    /bypass\s+(the\s+)?approval/i,
    /execute\s+without\s+approval/i,
  ];
  for (const pattern of bypassPatterns) {
    if (pattern.test(content)) {
      violations.push(`approval_bypass: Response contains approval bypass instruction: "${pattern.source}"`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Checks a request against company policies (loaded from the Policy table).
 * This is a lightweight check — it looks for policy-relevant keywords
 * in the prompt content.
 *
 * @param request - The LLM request
 * @param policies - Array of active company policies (from the database)
 */
export function checkPolicyCompliance(
  request: LLMRequest,
  policies: Array<{ code: string; name: string; description: string; category: string }>
): GuardrailResult {
  const violations: string[] = [];
  const allContent = request.messages.map((m) => m.content).join(" ").toLowerCase();

  for (const policy of policies) {
    // Check if the policy is relevant to this request
    const policyKeywords = policy.description.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const isRelevant = policyKeywords.some((kw) => allContent.includes(kw));

    if (isRelevant && policy.category === "data_access") {
      // Data access policies — check if the prompt asks to share PII externally
      if (allContent.includes("email") && (allContent.includes("phone") || allContent.includes("gstin") || allContent.includes("address"))) {
        violations.push(`policy_violation: ${policy.code} — Request may share PII in external communication`);
      }
    }

    if (isRelevant && policy.category === "escalation") {
      // Escalation policies — check if the prompt mentions legal action without proper aging
      if (allContent.includes("legal") && !allContent.includes("90")) {
        violations.push(`policy_violation: ${policy.code} — Legal escalation referenced but invoice aging < 90 days`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
