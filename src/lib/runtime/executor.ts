/**
 * BIHARI AI — Task Executor
 *
 * Processes a single step of a task. The worker calls this function once per
 * poll tick. This is the heart of the trust loop:
 *
 * 1. Find the next pending step
 * 2. Execute it (or create an approval gate)
 * 3. Write an audit entry atomically
 * 4. If approval needed: set task to waiting_approval and STOP
 * 5. If no more steps: set task to completed
 *
 * Per BED-001 §7: "The executor calls the LLM Gateway to produce the step's
 * reasoning and proposed action. The executor persists a task_steps row with
 * input, reasoning, and output."
 *
 * Per BED-001 §7: "If critical: creates an approvals row (status pending) with
 * the proposed action, appends audit entry approval_requested, sends a
 * notification, transitions the task to waiting_approval, and returns without
 * executing."
 */

import { db } from "@/lib/db";
import { appendAudit } from "./audit";
import { generatePlan, executeTool, type PlannedStep } from "./planner";
import { isFinanceTask, generateFinancePlan, generateBatchFinancePlan, executeFinanceTool } from "./finance-planner";
import { buildFinanceContext, produceRecommendation, type FinanceRecommendation } from "@/lib/finance/brain";
import { findInvoicesNeedingAttention } from "@/lib/finance/domain";
import { updateMemoryAfterTask, recordApprovalFeedback, extractFinanceMemories } from "@/lib/memory/service";
import { getLLMGateway } from "@/lib/llm";
import { generateContract, approveContract, rejectContract, linkApprovalToContract, type ContractInput } from "@/lib/contracts/engine";
import { checkCapability, recordCapabilityDenial } from "@/lib/capabilities/engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  action: "continue" | "waiting_approval" | "completed" | "failed";
  message: string;
}

// ─── Tool Display Names ──────────────────────────────────────────────────────

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  draft_response: "Draft Response",
  send_email: "Send Email",
  search_knowledge: "Search Knowledge",
  summarize: "Summarize",
  // Finance tools
  generate_reminder: "Generate Reminder",
  send_reminder: "Send Reminder",
  update_collection_case: "Update Collection Case",
};

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Processes one unit of work for a task.
 *
 * This function is called by the worker poll loop. It does ONE of:
 * - Plans the task (if status is "queued")
 * - Executes the next pending step (if status is "executing")
 * - Resolves an approval gate (if status is "executing" and next step is
 *   approval_gate with a decided approval)
 * - Completes the task (if no pending steps remain)
 *
 * All state changes and audit entries are written in a single transaction.
 */
export async function processTask(taskId: string): Promise<ExecutionResult> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      employee: true,
      steps: { orderBy: { stepNumber: "asc" } },
    },
  });

  if (!task) {
    return { action: "failed", message: "Task not found" };
  }

  // Don't process tasks that aren't in an active execution state
  if (!["queued", "planning", "executing"].includes(task.status)) {
    return { action: "continue", message: `Task is ${task.status}, skipping` };
  }

  // Check if the employee is paused
  if (task.employee.status === "paused") {
    // Pause the task
    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: "paused" },
      });
      await appendAudit(tx, {
        workspaceId: task.workspaceId,
        entryType: "task_paused",
        actorType: "system",
        actorId: null,
        actorName: "Runtime",
        targetType: "task",
        targetId: taskId,
        payload: { reason: "Employee paused", employee: task.employee.name },
      });
    });
    return { action: "continue", message: "Employee paused, task paused" };
  }

  // Phase 1: Planning — generate the step plan
  if (task.status === "queued") {
    return await planTask(task);
  }

  // Phase 2: Execution — process the next pending step
  const pendingSteps = task.steps.filter((s) => s.status === "pending");

  if (pendingSteps.length === 0) {
    // No pending steps — task is complete
    return await completeTask(task);
  }

  const nextStep = pendingSteps[0];
  return await executeStep(task, nextStep, task.steps);
}

// ─── Planning Phase ──────────────────────────────────────────────────────────

async function planTask(
  task: NonNullable<Awaited<ReturnType<typeof db.task.findUnique>>> & {}
): Promise<ExecutionResult> {
  const employee = task.employee;
  const employeeTools: string[] = JSON.parse(employee.tools);

  // Transition to planning
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: "planning", startedAt: task.startedAt ?? new Date() },
    });
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "task_started",
      actorType: "user",
      actorId: task.assignedBy,
      actorName: "Runtime",
      targetType: "task",
      targetId: task.id,
      payload: {
        title: task.title,
        employee: employee.name,
        role: employee.role,
      },
    });
  });

  // Generate the plan
  let plan: { steps: PlannedStep[] };

  // Check if this is a finance task
  if (isFinanceTask(employee.role, task.title, task.description)) {
    // Finance planning: use the Finance Brain to build context + produce recommendation
    const invoiceIdMatch = task.description.match(/invoice[_\s-]?id[:\s]+([a-zA-Z0-9]+)/i);
    const invoiceNumMatch = task.description.match(/invoice[_\s-]?number[:\s]+([A-Z0-9-]+)/i);

    if (invoiceIdMatch || invoiceNumMatch) {
      // Single invoice processing — Finance Brain builds full context + recommendation
      let invoiceId = invoiceIdMatch?.[1];

      // If we have an invoice number but no ID, look it up
      if (!invoiceId && invoiceNumMatch) {
        const inv = await db.invoice.findFirst({
          where: { invoiceNumber: invoiceNumMatch[1] },
        });
        invoiceId = inv?.id;
      }

      if (invoiceId) {
        // Step 1: Build the complete FinanceContext (invoice, customer, payments, reminders, policies, memory, etc.)
        const financeCtx = await buildFinanceContext(invoiceId, employee.id);
        if (financeCtx) {
          // Step 2: The Finance Brain reasons over the context (including memory) to produce a recommendation
          const recommendation = produceRecommendation(financeCtx);
          // Step 3: Generate the execution plan from the recommendation
          plan = generateFinancePlan(recommendation, employeeTools);
        } else {
          plan = { steps: [] };
        }
      } else {
        plan = { steps: [] };
      }
    } else {
      // Batch processing: find invoices needing attention, then build full context + recommendation for each
      const invoiceContexts = await findInvoicesNeedingAttention(task.workspaceId, 3); // Limit to 3 per task
      if (invoiceContexts.length > 0) {
        // For each invoice, build the full FinanceContext and produce a recommendation
        const recommendations: FinanceRecommendation[] = [];
        for (const ic of invoiceContexts) {
          const financeCtx = await buildFinanceContext(ic.invoiceId, employee.id);
          if (financeCtx) {
            const rec = produceRecommendation(financeCtx);
            recommendations.push(rec);
          }
        }
        if (recommendations.length > 0) {
          plan = generateBatchFinancePlan(recommendations, employeeTools);
        } else {
          plan = { steps: [] };
        }
      } else {
        plan = { steps: [] };
      }
    }
  } else {
    // Generic planning
    // Check if the LLM Gateway has a real provider available (not mock)
    const gateway = getLLMGateway();
    const router = (await import("@/lib/llm")).getModelRouter();
    const { provider, route } = router.route("planning");

    if (provider.name !== "mock") {
      // ─── LLM-Gateway-Aware Planning ──────────────────────────────────────
      // When a real LLM provider is configured, use the gateway to generate
      // the execution plan. This replaces the deterministic mock planner
      // with real AI planning.
      try {
        const response = await gateway.complete({
          taskType: "planning",
          promptId: "planning",
          variables: {
            title: task.title,
            description: task.description,
            role: employee.role,
            tools: employeeTools.join(", "),
          },
          jsonMode: true,
          jsonSchema: {
            type: "object",
            required: ["reasoning", "steps"],
            properties: {
              reasoning: { type: "string" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  required: ["stepType", "reasoning", "confidence"],
                  properties: {
                    stepType: { type: "string" },
                    reasoning: { type: "string" },
                    tool: { type: "string" },
                    confidence: { type: "number" },
                  },
                },
              },
            },
          },
          workspaceId: task.workspaceId,
          employeeId: employee.id,
          taskId: task.id,
        });

        // Parse the LLM-generated plan
        const llmPlan = response.data as { reasoning: string; steps: PlannedStep[] } | null;
        if (llmPlan && llmPlan.steps && Array.isArray(llmPlan.steps)) {
          plan = { steps: llmPlan.steps };
        } else {
          // Fallback to deterministic planner if LLM response is invalid
          plan = generatePlan(task.title, task.description, employee.role, employeeTools);
        }
      } catch (err) {
        // On any gateway error, fall back to the deterministic planner
        console.error("[Executor] LLM Gateway planning failed, falling back to deterministic planner:", err);
        plan = generatePlan(task.title, task.description, employee.role, employeeTools);
      }
    } else {
      // ─── Deterministic Planning (existing behavior) ─────────────────────
      // No real LLM provider configured — use the existing mock planner.
      // This maintains backward compatibility.
      plan = generatePlan(task.title, task.description, employee.role, employeeTools);
    }
  }

  if (plan.steps.length === 0) {
    // No steps to execute — fail immediately
    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });
      await appendAudit(tx, {
        workspaceId: task.workspaceId,
        entryType: "task_failed",
        actorType: "employee",
        actorId: employee.id,
        actorName: employee.name,
        targetType: "task",
        targetId: task.id,
        payload: { reason: "Plan generation produced no steps" },
      });
    });
    return { action: "failed", message: "Plan generation produced no steps" };
  }

  // Check step cap
  if (plan.steps.length > task.stepCap) {
    plan.steps = plan.steps.slice(0, task.stepCap);
  }

  // Write the plan step (step 0 — the planning reasoning)
  const approvalRules: Record<string, string> = JSON.parse(employee.approvalRules);

  await db.$transaction(async (tx) => {
    // Step 0: The plan itself
    const isFinance = isFinanceTask(employee.role, task.title, task.description);
    const criticalCount = plan.steps.filter((s) => s.tool === "send_email" || s.tool === "send_reminder").length;
    await tx.taskStep.create({
      data: {
        taskId: task.id,
        stepNumber: 0,
        stepType: "plan",
        reasoning: isFinance
          ? `Planned ${plan.steps.length} steps for this finance collections task. The plan includes ${criticalCount} critical action(s) requiring human approval.`
          : `Planned ${plan.steps.length} steps for this task. The plan includes ${criticalCount} email action(s) that will require human approval.`,
        status: "completed",
        tokens: 420,
        durationMs: 3100,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Write each planned step as pending
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const isCritical = step.tool ? approvalRules[step.tool] === "critical" : false;

      await tx.taskStep.create({
        data: {
          taskId: task.id,
          stepNumber: i + 1,
          stepType: isCritical ? "approval_gate" : step.stepType,
          input: JSON.stringify({
            tool: step.tool || null,
            ...step.toolInput,
          }),
          reasoning: step.reasoning,
          status: "pending",
          confidence: step.confidence,
        },
      });
    }

    // Transition to executing
    await tx.task.update({
      where: { id: task.id },
      data: { status: "executing", stepCount: plan.steps.length + 1 },
    });

    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "plan_created",
      actorType: "employee",
      actorId: employee.id,
      actorName: employee.name,
      targetType: "task",
      targetId: task.id,
      payload: {
        step_count: String(plan.steps.length),
        critical_steps: String(plan.steps.filter((s) => s.tool && approvalRules[s.tool] === "critical").length),
      },
    });
  });

  return { action: "continue", message: `Planned ${plan.steps.length} steps, now executing` };
}

// ─── Step Execution ──────────────────────────────────────────────────────────

async function executeStep(
  task: any,
  step: any,
  allSteps: any[]
): Promise<ExecutionResult> {
  const employee = task.employee;

  // Mark step as running
  await db.taskStep.update({
    where: { id: step.id },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    switch (step.stepType) {
      case "reasoning":
        return await executeReasoningStep(task, step, employee);

      case "tool_call":
        return await executeToolStep(task, step, employee);

      case "approval_gate":
        return await executeApprovalGateStep(task, step, employee);

      default:
        return await executeReasoningStep(task, step, employee);
    }
  } catch (err) {
    // Mark step as failed and fail the task
    await db.$transaction(async (tx) => {
      await tx.taskStep.update({
        where: { id: step.id },
        data: { status: "failed", completedAt: new Date() },
      });
      await tx.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });
      await appendAudit(tx, {
        workspaceId: task.workspaceId,
        entryType: "task_failed",
        actorType: "employee",
        actorId: employee.id,
        actorName: employee.name,
        targetType: "task",
        targetId: task.id,
        payload: {
          reason: `Step ${step.stepNumber} failed: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      });
    });
    return { action: "failed", message: `Step ${step.stepNumber} failed` };
  }
}

// ─── Reasoning Step ──────────────────────────────────────────────────────────

async function executeReasoningStep(task: any, step: any, employee: any): Promise<ExecutionResult> {
  const tokens = 500 + Math.floor(Math.random() * 400);
  const durationMs = 1500 + Math.floor(Math.random() * 1500);

  await db.$transaction(async (tx) => {
    await tx.taskStep.update({
      where: { id: step.id },
      data: {
        status: "completed",
        output: JSON.stringify({ type: "reasoning" }),
        tokens,
        durationMs,
        completedAt: new Date(),
      },
    });

    await tx.task.update({
      where: { id: task.id },
      data: { tokenUsage: { increment: tokens } },
    });

    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "step_executed",
      actorType: "employee",
      actorId: employee.id,
      actorName: employee.name,
      targetType: "task_step",
      targetId: step.id,
      payload: {
        step: String(step.stepNumber),
        type: "reasoning",
        tokens: String(tokens),
      },
    });
  });

  return { action: "continue", message: `Reasoning step ${step.stepNumber} completed` };
}

// ─── Tool Call Step (non-critical) ───────────────────────────────────────────

async function executeToolStep(task: any, step: any, employee: any): Promise<ExecutionResult> {
  const input = JSON.parse(step.input);
  const toolName = input.tool;

  if (!toolName) {
    // No tool specified — treat as reasoning
    return await executeReasoningStep(task, step, employee);
  }

  // ─── Capability Verification ──────────────────────────────────────────────
  // Before ANY tool execution, verify the employee has the required capability.
  // If denied: stop execution, write audit event, fail the step.
  const capCheck = await checkCapability(employee.id, toolName);
  if (!capCheck.allowed) {
    await db.$transaction(async (tx) => {
      // Mark step as failed
      await tx.taskStep.update({
        where: { id: step.id },
        data: {
          status: "failed",
          output: JSON.stringify({
            error: "CAPABILITY_DENIED",
            requiredCapability: capCheck.capabilityCode,
            capabilityName: capCheck.capabilityName,
            reason: capCheck.reason,
          }),
          completedAt: new Date(),
        },
      });

      // Fail the task
      await tx.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });

      // Update employee state
      await tx.employee.update({
        where: { id: employee.id },
        data: { state: "idle" },
      });

      // Record the denial in the audit chain
      await recordCapabilityDenial(tx, task.workspaceId, employee.id, employee.name, toolName, capCheck);
    });

    return { action: "failed", message: `Capability denied: ${capCheck.capabilityCode} required for ${toolName}` };
  }

  // Check if this is a finance tool
  const financeTools = ["generate_reminder", "send_reminder", "update_collection_case"];
  const isFinanceTool = financeTools.includes(toolName);

  // Execute the tool
  let result: { output: Record<string, string>; tokens: number; durationMs: number };

  if (isFinanceTool) {
    result = await executeFinanceTool(toolName, input, task.workspaceId, employee.id);
  } else {
    result = executeTool(toolName, input);
  }

  // Determine the finance-specific audit entry type
  let auditEntryType = "tool_executed";
  if (toolName === "generate_reminder") auditEntryType = "reminder_drafted";
  else if (toolName === "update_collection_case") auditEntryType = "collection_case_updated";

  await db.$transaction(async (tx) => {
    await tx.taskStep.update({
      where: { id: step.id },
      data: {
        status: "completed",
        output: JSON.stringify(result.output),
        tokens: result.tokens,
        durationMs: result.durationMs,
        completedAt: new Date(),
      },
    });

    await tx.task.update({
      where: { id: task.id },
      data: { tokenUsage: { increment: result.tokens } },
    });

    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: auditEntryType,
      actorType: "employee",
      actorId: employee.id,
      actorName: employee.name,
      targetType: isFinanceTool ? "invoice" : "task_step",
      targetId: input.invoiceId || step.id,
      payload: {
        tool: toolName,
        status: "completed",
        tokens: String(result.tokens),
        ...(input.invoiceNumber ? { invoiceNumber: input.invoiceNumber } : {}),
        ...(input.customerName ? { customer: input.customerName } : {}),
      },
    });
  });

  return { action: "continue", message: `Tool ${toolName} executed` };
}

// ─── Approval Gate Step (critical tool call) ─────────────────────────────────

async function executeApprovalGateStep(task: any, step: any, employee: any): Promise<ExecutionResult> {
  const input = JSON.parse(step.input);
  const toolName = input.tool;

  // ─── Capability Verification (pre-approval) ───────────────────────────────
  // Before creating an approval gate, verify the employee has the capability.
  // If denied: stop execution, write audit event, fail the step.
  const capCheck = await checkCapability(employee.id, toolName);
  if (!capCheck.allowed) {
    await db.$transaction(async (tx) => {
      await tx.taskStep.update({
        where: { id: step.id },
        data: {
          status: "failed",
          output: JSON.stringify({
            error: "CAPABILITY_DENIED",
            requiredCapability: capCheck.capabilityCode,
            capabilityName: capCheck.capabilityName,
            reason: capCheck.reason,
          }),
          completedAt: new Date(),
        },
      });
      await tx.task.update({
        where: { id: task.id },
        data: { status: "failed" },
      });
      await tx.employee.update({
        where: { id: employee.id },
        data: { state: "idle" },
      });
      await recordCapabilityDenial(tx, task.workspaceId, employee.id, employee.name, toolName, capCheck);
    });
    return { action: "failed", message: `Capability denied: ${capCheck.capabilityCode} required for ${toolName}` };
  }

  // Check if an approval already exists for this task
  const existingApproval = await db.approval.findFirst({
    where: { taskId: task.id, status: "pending" },
  });

  if (existingApproval) {
    // Approval already exists — task should be waiting_approval
    // This shouldn't happen if the state machine is correct, but handle it
    await db.task.update({
      where: { id: task.id },
      data: { status: "waiting_approval" },
    });
    return { action: "waiting_approval", message: "Approval already pending" };
  }

  // Create the approval
  const proposedAction: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k !== "tool") proposedAction[k] = String(v);
  }

  const timeoutAt = new Date();
  timeoutAt.setHours(timeoutAt.getHours() + 12); // 12-hour timeout

  // ─── Generate Execution Contract ──────────────────────────────────────────
  // Before creating the approval, generate an immutable Execution Contract.
  // The contract captures the complete decision context at this moment.
  // The approval references the contract — not mutable task state.
  const isFinanceApproval = toolName === "send_reminder";

  // Build contract input from the step's input (which contains the Finance
  // Brain's recommendation for finance tasks, or the tool input for generic tasks)
  const contractInput: ContractInput = {
    taskId: task.id,
    employeeId: employee.id,
    workspaceId: task.workspaceId,
    goal: isFinanceApproval
      ? `Send collection reminder for Invoice ${input.invoiceNumber || "N/A"} to ${input.customerName || "customer"}`
      : `Execute ${toolName} for task: ${task.title}`,
    proposedAction,
    confidence: input.confidence ? parseFloat(input.confidence) : 0.85,
    evidence: input.evidence ? safeParseJson(input.evidence, []) : [],
    memoriesUsed: [], // Populated from the Finance Brain context if available
    policiesUsed: input.policyInfluence ? safeParseJson(input.policyInfluence, []) : [],
    businessImpact: input.businessImpact || input.riskAssessment || "Critical action requiring human approval before execution.",
    affectedSystems: isFinanceApproval
      ? ["invoices", "reminders", "collection_cases"]
      : ["task_steps"],
    rollbackPlan: isFinanceApproval
      ? `Mark the reminder as "not sent" in the reminders table. No external side effects if caught before the email provider sends. If already sent, send a follow-up correction email.`
      : `Mark the tool execution as failed in the task step. No rollback needed for non-external actions.`,
    estimatedBusinessOutcome: isFinanceApproval
      ? `Prompt payment from ${input.customerName || "customer"}, reducing outstanding receivables by ${input.outstanding || "the outstanding amount"}.`
      : `Complete the task step and continue execution.`,
    estimatedTokenCost: 200,
    estimatedExecutionTime: 1000,
    requiredAuthority: "owner",
  };

  const contract = await generateContract(contractInput);

  await db.$transaction(async (tx) => {
    // Create the approval record — references the contract
    const approval = await tx.approval.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        employeeId: employee.id,
        tool: toolName,
        toolDisplayName: TOOL_DISPLAY_NAMES[toolName] || toolName,
        proposedAction: JSON.stringify(proposedAction),
        status: "pending",
        criticality: "critical",
        timeoutAt,
      },
    });

    // Link the contract to the approval
    // (done outside the transaction to avoid FK issues — best-effort)
    // We store the contract ID in the step output instead

    // Update the step to reference the approval AND the contract
    await tx.taskStep.update({
      where: { id: step.id },
      data: {
        status: "pending", // stays pending until approval is decided
        output: JSON.stringify({
          approvalId: approval.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          contractVersion: contract.version,
          contractHash: contract.contractHash,
          status: "waiting",
        }),
      },
    });

    // Transition task to waiting_approval
    await tx.task.update({
      where: { id: task.id },
      data: { status: "waiting_approval" },
    });

    // Update employee state
    await tx.employee.update({
      where: { id: employee.id },
      data: { state: "waiting_approval", pendingApprovals: { increment: 1 } },
    });

    // Link contract to approval (best-effort, outside transaction boundary)
    // We do this after the transaction commits to avoid FK constraint issues
    // The contract ID is already in the step output, so it's recoverable

    // Write audit entry — include finance reasoning chain AND contract hash
    const isFinanceApproval = toolName === "send_reminder";
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: isFinanceApproval ? "reminder_approval_requested" : "approval_requested",
      actorType: "employee",
      actorId: employee.id,
      actorName: employee.name,
      targetType: isFinanceApproval ? "invoice" : "approval",
      targetId: isFinanceApproval ? (input.invoiceId || approval.id) : approval.id,
      payload: {
        tool: toolName,
        task: task.title,
        criticality: "critical",
        // ─── Execution Contract Reference ──────────────────────────────────
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractVersion: String(contract.version),
        contractHash: contract.contractHash,
        // ─── Finance Brain Reasoning Chain ──────────────────────────────────
        ...(input.invoiceNumber ? { invoiceNumber: input.invoiceNumber } : {}),
        ...(input.customerName ? { customer: input.customerName } : {}),
        ...(input.outstanding ? { outstanding: input.outstanding } : {}),
        ...(input.daysOverdue ? { daysOverdue: input.daysOverdue } : {}),
        ...(input.recommendedAction ? { recommendedAction: input.recommendedAction } : {}),
        ...(input.why ? { why: input.why.substring(0, 500) } : {}),
        ...(input.confidence ? { confidence: input.confidence } : {}),
        ...(input.riskAssessment ? { riskAssessment: input.riskAssessment.substring(0, 200) } : {}),
        ...(input.policyInfluence ? { policies: input.policyInfluence.substring(0, 300) } : {}),
        ...(input.customerHistoryInfluence ? { customerHistory: input.customerHistoryInfluence.substring(0, 300) } : {}),
        ...(input.rejectedAlternatives ? { rejectedAlternatives: input.rejectedAlternatives.substring(0, 300) } : {}),
      },
    });

    // Create a notification for the user
    const task2 = await tx.task.findUnique({ where: { id: task.id } });
    if (task2) {
      const notifTitle = isFinanceApproval
        ? `${employee.name} needs approval to send a reminder`
        : `${employee.name} needs your approval`;
      const notifBody = isFinanceApproval
        ? `Invoice ${input.invoiceNumber || ""} — ${input.customerName || ""}: ${input.why ? input.why.substring(0, 150) : "Reminder requires approval with full finance reasoning."}`
        : `${TOOL_DISPLAY_NAMES[toolName] || toolName} — ${proposedAction.to || proposedAction.subject || "Action requires review"}`;
      await tx.notification.create({
        data: {
          workspaceId: task.workspaceId,
          userId: task2.assignedBy,
          type: "approval_pending",
          title: notifTitle,
          body: notifBody,
          referenceType: "approval",
          referenceId: approval.id,
          channel: "in_app",
          status: "delivered",
        },
      });
    }
  });

  return { action: "waiting_approval", message: `Approval requested for ${toolName}` };
}

// ─── Task Completion ─────────────────────────────────────────────────────────

async function completeTask(task: any): Promise<ExecutionResult> {
  const employee = task.employee;

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    // Update employee state and counters
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        state: "idle",
        completedTasks: { increment: 1 },
      },
    });

    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "task_completed",
      actorType: "employee",
      actorId: employee.id,
      actorName: employee.name,
      targetType: "task",
      targetId: task.id,
      payload: {
        title: task.title,
        steps: String(task.stepCount),
        tokens: String(task.tokenUsage),
      },
    });

    // Create a notification
    await tx.notification.create({
      data: {
        workspaceId: task.workspaceId,
        userId: task.assignedBy,
        type: "task_completed",
        title: `${employee.name} completed a task`,
        body: task.title,
        referenceType: "task",
        referenceId: task.id,
        channel: "in_app",
        status: "delivered",
      },
    });
  });

  // ─── Update Employee Memory ──────────────────────────────────────────────
  // After every completed task, the employee learns from the outcome.
  // Generic memories (strategy, approval feedback, communication) are
  // extracted first, then domain-specific memories (finance) if applicable.
  try {
    await updateMemoryAfterTask(employee.id, task.workspaceId, task.id);

    // If this was a finance task, also extract finance-specific memories
    if (isFinanceTask(employee.role, task.title, task.description)) {
      await extractFinanceMemories(employee.id, task.workspaceId, task.id);
    }
  } catch (err) {
    // Memory update failure should not fail the task — log and continue
    console.error(`[Executor] Memory update failed for task ${task.id}:`, err);
  }

  return { action: "completed", message: "Task completed" };
}

// ─── Resume After Approval ───────────────────────────────────────────────────

/**
 * Called by the approval API when a human approves an action.
 * Marks the approval_gate step as completed and transitions the task back
 * to executing so the worker can continue with the next step.
 *
 * Also "executes" the approved tool (e.g., actually sends the email in a
 * real implementation).
 */
export async function resumeAfterApproval(
  taskId: string,
  approvalId: string,
  approvedBy: string,
  approvedByName: string
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { employee: true, steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!task) return;

  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) return;

  // Find the approval_gate step that was waiting
  const gateStep = task.steps.find(
    (s) => s.stepType === "approval_gate" && s.status === "pending"
  );

  // ─── Capability Verification (post-approval) ──────────────────────────────
  // Even after approval, verify the employee still has the capability.
  // Capabilities can be revoked between approval and execution.
  const postApprovalCapCheck = await checkCapability(task.employeeId, approval.tool);
  if (!postApprovalCapCheck.allowed) {
    // Capability was revoked after approval — fail the task
    await db.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: "failed" },
      });
      await tx.employee.update({
        where: { id: task.employeeId },
        data: { state: "idle", pendingApprovals: { decrement: 1 } },
      });
      await recordCapabilityDenial(tx, task.workspaceId, task.employeeId, task.employee.name, approval.tool, postApprovalCapCheck);
    });
    return;
  }

  // Execute the approved tool BEFORE the transaction (it may do DB operations)
  const proposedAction = JSON.parse(approval.proposedAction);
  const financeTools = ["generate_reminder", "send_reminder", "update_collection_case"];
  const isFinanceTool = financeTools.includes(approval.tool);

  let toolResult: { output: Record<string, string>; tokens: number; durationMs: number };
  if (isFinanceTool) {
    toolResult = await executeFinanceTool(approval.tool, proposedAction, task.workspaceId, task.employeeId);
  } else {
    toolResult = executeTool(approval.tool, proposedAction);
  }

  await db.$transaction(async (tx) => {
    // Mark the gate step as completed
    if (gateStep) {
      await tx.taskStep.update({
        where: { id: gateStep.id },
        data: {
          status: "completed",
          output: JSON.stringify({
            ...toolResult.output,
            approvalId,
            approvedBy: approvedByName,
          }),
          tokens: toolResult.tokens,
          durationMs: toolResult.durationMs,
          completedAt: new Date(),
        },
      });
    }

    // Transition task back to executing
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: "executing",
        tokenUsage: { increment: toolResult.tokens },
      },
    });

    // Update employee state
    await tx.employee.update({
      where: { id: task.employeeId },
      data: {
        state: "executing",
        pendingApprovals: { decrement: 1 },
      },
    });

    // Write audit entry for the approval decision
    const isFinanceApproval = approval.tool === "send_reminder";
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: isFinanceApproval ? "reminder_approved" : "approval_decided",
      actorType: "user",
      actorId: approvedBy,
      actorName: approvedByName,
      targetType: isFinanceApproval ? "invoice" : "approval",
      targetId: isFinanceApproval ? (proposedAction.invoiceId || approvalId) : approvalId,
      payload: {
        decision: "approved",
        tool: approval.tool,
        employee: task.employee.name,
        ...(proposedAction.invoiceNumber ? { invoiceNumber: proposedAction.invoiceNumber } : {}),
        ...(proposedAction.customerName ? { customer: proposedAction.customerName } : {}),
      },
    });

    // Write audit entry for the tool execution
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: isFinanceApproval ? "reminder_sent" : "tool_executed",
      actorType: "employee",
      actorId: task.employeeId,
      actorName: task.employee.name,
      targetType: isFinanceApproval ? "invoice" : "task_step",
      targetId: proposedAction.invoiceId || gateStep?.id || "",
      payload: {
        tool: approval.tool,
        status: "completed",
        approved_by: approvedByName,
        ...(proposedAction.invoiceNumber ? { invoiceNumber: proposedAction.invoiceNumber } : {}),
        ...(proposedAction.customerName ? { customer: proposedAction.customerName } : {}),
      },
    });
  });

  // ─── Approve the Execution Contract ──────────────────────────────────────
  // The contract becomes immutable. Its hash is locked.
  try {
    // Find the contract linked to this task's approval gate step
    if (gateStep) {
      const stepOutput = JSON.parse(gateStep.output || "{}");
      if (stepOutput.contractId) {
        await approveContract(stepOutput.contractId, approvedBy);
        await linkApprovalToContract(stepOutput.contractId, approvalId);
      }
    }
  } catch (err) {
    console.error(`[Executor] Contract approval failed for approval ${approvalId}:`, err);
  }

  // ─── Record Approval Feedback in Memory ──────────────────────────────────
  // The employee learns from the manager's approval decision immediately.
  try {
    await recordApprovalFeedback(
      task.employeeId,
      task.workspaceId,
      approvalId,
      "approved",
      null,
      approval.tool,
      proposedAction
    );
  } catch (err) {
    console.error(`[Executor] Memory recording failed for approval ${approvalId}:`, err);
  }
}

/**
 * Called by the approval API when a human rejects an action.
 * Marks the approval_gate step as failed and transitions the task to failed.
 */
export async function failAfterApprovalRejection(
  taskId: string,
  approvalId: string,
  rejectedBy: string,
  rejectedByName: string,
  reason?: string
): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { employee: true, steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!task) return;

  // Fetch the approval to get the tool name
  const approvalRecord = await db.approval.findUnique({ where: { id: approvalId } });

  const gateStep = task.steps.find(
    (s) => s.stepType === "approval_gate" && s.status === "pending"
  );

  await db.$transaction(async (tx) => {
    // Mark the gate step as failed
    if (gateStep) {
      await tx.taskStep.update({
        where: { id: gateStep.id },
        data: {
          status: "failed",
          output: JSON.stringify({
            approvalId,
            rejectedBy: rejectedByName,
            reason: reason || "Rejected by human",
          }),
          completedAt: new Date(),
        },
      });
    }

    // Transition task to failed
    await tx.task.update({
      where: { id: taskId },
      data: { status: "failed" },
    });

    // Update employee state
    await tx.employee.update({
      where: { id: task.employeeId },
      data: {
        state: "idle",
        pendingApprovals: { decrement: 1 },
      },
    });

    // Write audit entry for the approval decision
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "approval_decided",
      actorType: "user",
      actorId: rejectedBy,
      actorName: rejectedByName,
      targetType: "approval",
      targetId: approvalId,
      payload: {
        decision: "rejected",
        tool: approvalRecord?.tool || "",
        employee: task.employee.name,
        reason: reason || "Rejected",
      },
    });

    // Write task_failed audit
    await appendAudit(tx, {
      workspaceId: task.workspaceId,
      entryType: "task_failed",
      actorType: "user",
      actorId: rejectedBy,
      actorName: rejectedByName,
      targetType: "task",
      targetId: taskId,
      payload: {
        reason: `Approval rejected: ${reason || "No reason provided"}`,
      },
    });
  });

  // ─── Record Rejection Feedback in Memory ──────────────────────────────────
  // The employee learns from the manager's rejection — this is especially
  // important because rejections often carry a reason that teaches the
  // employee what NOT to do next time.
  try {
    const proposedAction = JSON.parse(approvalRecord?.proposedAction || "{}");
    await recordApprovalFeedback(
      task.employeeId,
      task.workspaceId,
      approvalId,
      "rejected",
      reason || null,
      approvalRecord?.tool || "",
      proposedAction
    );
  } catch (err) {
    console.error(`[Executor] Memory recording failed for rejection ${approvalId}:`, err);
  }

  // ─── Reject the Execution Contract ────────────────────────────────────────
  // The contract is marked as rejected but remains permanently searchable.
  try {
    if (gateStep) {
      const stepOutput = JSON.parse(gateStep.output || "{}");
      if (stepOutput.contractId) {
        await rejectContract(stepOutput.contractId, rejectedBy, reason);
      }
    }
  } catch (err) {
    console.error(`[Executor] Contract rejection failed for approval ${approvalId}:`, err);
  }
}

// ─── Helper: Safe JSON Parse ─────────────────────────────────────────────────

function safeParseJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
