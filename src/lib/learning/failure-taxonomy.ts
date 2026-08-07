/**
 * BIHARI AI — Failure Taxonomy Engine
 *
 * Classifies task failures into a structured taxonomy so that:
 *   • Failures are queryable and aggregatable (not just free-text)
 *   • Failure patterns can be detected (e.g., "Kavya fails 30% of tasks
 *     involving customer X" or "planning failures spike on Mondays")
 *   • Trust reports can state "99.2% success, 0.8% recoverable failures"
 *   • The learning engine can detect weaknesses from STRUCTURED failure
 *     data, not just from successful outcomes
 *
 * Taxonomy dimensions:
 *
 *   failureType (what went wrong):
 *     planning_failure       — plan generation produced no steps or invalid plan
 *     tool_execution_failure — a tool call threw an error or returned invalid output
 *     approval_rejected      — a human rejected the proposed action
 *     capability_denied      — the employee lacked a required capability
 *     timeout                — the task or an approval gate timed out
 *     step_cap_exceeded      — the task exceeded its step cap without completing
 *     llm_error              — the LLM provider returned an error or invalid response
 *     unknown                — unclassified (fallback)
 *
 *   failureCategory (is it recoverable?):
 *     recoverable   — retrying might succeed (timeout, llm_error, tool_execution_failure)
 *     terminal      — the task cannot succeed as given (planning_failure with no steps)
 *     policy_block  — a policy decision stopped execution (capability_denied, approval_rejected)
 *
 *   failureSeverity (how bad is it?):
 *     low    — recoverable, no business impact (timeout on non-critical step)
 *     medium — needs attention but not critical (tool_execution_failure on 1 of N invoices)
 *     high   — critical failure, business impact (planning_failure, capability_denied on core function)
 *
 * The classification is DETERMINISTIC — same input always produces the same
 * classification. This is essential for trust: the taxonomy must be
 * reproducible and auditable, not dependent on an LLM's mood.
 */

export type FailureType =
  | "planning_failure"
  | "tool_execution_failure"
  | "approval_rejected"
  | "capability_denied"
  | "timeout"
  | "step_cap_exceeded"
  | "llm_error"
  | "unknown";

export type FailureCategory =
  | "recoverable"
  | "terminal"
  | "policy_block";

export type FailureSeverity = "low" | "medium" | "high";

export interface FailureClassification {
  failureType: FailureType;
  failureCategory: FailureCategory;
  failureSeverity: FailureSeverity;
}

export interface FailureContext {
  /** The step type where the failure occurred, if applicable. */
  stepType?: string;
  /** The tool that was being executed, if applicable. */
  tool?: string;
  /** Whether the failure was an approval rejection. */
  approvalRejected?: boolean;
  /** Whether the failure was an approval timeout/expiration. */
  approvalExpired?: boolean;
  /** Whether the failure was during planning. */
  duringPlanning?: boolean;
}

/**
 * Maps a free-text failure reason + context to a structured classification.
 *
 * Deterministic: uses keyword matching, not LLM. This guarantees
 * reproducibility and auditability — the same failure always classifies
 * the same way.
 */
export function classifyFailure(
  reason: string,
  context: FailureContext = {}
): FailureClassification {
  const r = reason.toLowerCase();

  // ─── Approval rejection ──────────────────────────────────────────────────
  if (context.approvalRejected || r.includes("approval rejected") || r.includes("rejected by human")) {
    return {
      failureType: "approval_rejected",
      failureCategory: "policy_block",
      failureSeverity: "medium",
    };
  }

  // ─── Approval timeout/expiration ─────────────────────────────────────────
  if (context.approvalExpired || r.includes("expired") || r.includes("approval timeout")) {
    return {
      failureType: "timeout",
      failureCategory: "recoverable",
      failureSeverity: "medium",
    };
  }

  // ─── Capability denied ───────────────────────────────────────────────────
  if (r.includes("capability denied") || r.includes("capability") && r.includes("required")) {
    return {
      failureType: "capability_denied",
      failureCategory: "policy_block",
      failureSeverity: "high",
    };
  }

  // ─── Planning failure ────────────────────────────────────────────────────
  if (
    context.duringPlanning ||
    r.includes("plan generation") ||
    r.includes("no steps") ||
    r.includes("planning failed") ||
    r.includes("empty plan")
  ) {
    return {
      failureType: "planning_failure",
      failureCategory: "terminal",
      failureSeverity: "high",
    };
  }

  // ─── Step cap exceeded ───────────────────────────────────────────────────
  if (r.includes("step cap") || r.includes("step limit") || r.includes("max steps")) {
    return {
      failureType: "step_cap_exceeded",
      failureCategory: "terminal",
      failureSeverity: "medium",
    };
  }

  // ─── LLM error ───────────────────────────────────────────────────────────
  if (
    r.includes("llm") ||
    r.includes("language model") ||
    r.includes("provider") && r.includes("error") ||
    r.includes("rate limit") ||
    r.includes("api key") ||
    r.includes("gemini") && r.includes("error") ||
    r.includes("openai") && r.includes("error")
  ) {
    return {
      failureType: "llm_error",
      failureCategory: "recoverable",
      failureSeverity: "medium",
    };
  }

  // ─── Timeout ─────────────────────────────────────────────────────────────
  if (r.includes("timeout") || r.includes("timed out") || r.includes("deadline")) {
    return {
      failureType: "timeout",
      failureCategory: "recoverable",
      failureSeverity: "low",
    };
  }

  // ─── Tool execution failure ──────────────────────────────────────────────
  if (
    context.stepType === "tool_call" ||
    context.tool ||
    r.includes("tool") ||
    r.includes("step") && r.includes("failed")
  ) {
    return {
      failureType: "tool_execution_failure",
      failureCategory: "recoverable",
      failureSeverity: "medium",
    };
  }

  // ─── Unknown (fallback) ──────────────────────────────────────────────────
  return {
    failureType: "unknown",
    failureCategory: "recoverable",
    failureSeverity: "low",
  };
}

/**
 * Human-readable label for a failure type, for UI display.
 */
export function failureTypeLabel(type: FailureType): string {
  const labels: Record<FailureType, string> = {
    planning_failure: "Planning Failure",
    tool_execution_failure: "Tool Execution Failure",
    approval_rejected: "Approval Rejected",
    capability_denied: "Capability Denied",
    timeout: "Timeout",
    step_cap_exceeded: "Step Limit Exceeded",
    llm_error: "AI Provider Error",
    unknown: "Unclassified Failure",
  };
  return labels[type] ?? "Unknown Failure";
}

/**
 * Human-readable description for a failure category.
 */
export function failureCategoryLabel(category: FailureCategory): string {
  const labels: Record<FailureCategory, string> = {
    recoverable: "Recoverable — retrying may succeed",
    terminal: "Terminal — task cannot succeed as given",
    policy_block: "Policy block — a governance rule stopped execution",
  };
  return labels[category] ?? category;
}
