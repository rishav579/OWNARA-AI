/**
 * OWNARA — LLM Planner
 *
 * Generates execution plans (lists of steps) for tasks based on the task
 * description and the employee's role and configured tools.
 *
 * When a real LLM provider is configured (Gemini/OpenAI/Anthropic), this
 * module calls the LLM Gateway to produce AI-generated plans. When only the
 * mock provider is available, it falls back to a deterministic keyword-based
 * planner that produces realistic step sequences exercising the full trust
 * loop including approval gates.
 *
 * Per BED-001 §13: "LLM_PROVIDER=mock routes the LLM Gateway to the mock
 * adapter."
 */

import { getLLMGateway, getModelRouter } from "@/lib/llm";

export interface PlannedStep {
  stepType: "reasoning" | "tool_call";
  reasoning: string;
  tool?: string;
  toolInput?: Record<string, string>;
  confidence: number;
}

export interface ExecutionPlan {
  steps: PlannedStep[];
}

/**
 * Generates an execution plan for a task.
 *
 * When a real LLM provider is configured, this calls the LLM Gateway with
 * the "planning" prompt to produce an AI-generated plan. When only the mock
 * provider is available, it falls back to the deterministic keyword-based
 * planner.
 *
 * The plan is a list of steps that the executor will process sequentially.
 * Each step is either:
 * - "reasoning": the AI explains what it's doing and why (no tool call)
 * - "tool_call": the AI calls a tool (search_knowledge, draft_response,
 *   send_email, summarize)
 *
 * The planner does NOT decide whether a tool call is critical — that's the
 * executor's job, based on the employee's approvalRules. The planner just
 * says "call send_email"; the executor checks the rules and, if critical,
 * creates an approval gate instead of executing immediately.
 *
 * @param taskTitle - The task title
 * @param taskDescription - The task description
 * @param employeeRole - The employee's role key
 * @param employeeTools - The tools granted to the employee
 */
export async function generatePlan(
  taskTitle: string,
  taskDescription: string,
  employeeRole: string,
  employeeTools: string[]
): Promise<ExecutionPlan> {
  // Check if a real LLM provider is available (not mock)
  try {
    const router = getModelRouter();
    const { provider } = router.route("planning");

    if (provider.name !== "mock") {
      // ─── LLM-Gateway-Aware Planning ──────────────────────────────────────
      const gateway = getLLMGateway();
      const response = await gateway.complete({
        taskType: "planning",
        promptId: "planning",
        variables: {
          title: taskTitle,
          description: taskDescription,
          role: employeeRole,
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
      });

      const llmPlan = response.data as { reasoning: string; steps: PlannedStep[] } | null;
      if (llmPlan && llmPlan.steps && Array.isArray(llmPlan.steps) && llmPlan.steps.length > 0) {
        // Validate and sanitize the LLM-generated steps
        const validSteps = llmPlan.steps
          .filter((s) => s.stepType && s.reasoning)
          .map((s) => ({
            stepType: s.stepType === "tool_call" ? "tool_call" as const : "reasoning" as const,
            reasoning: s.reasoning,
            tool: s.tool && employeeTools.includes(s.tool) ? s.tool : undefined,
            toolInput: s.tool ? {} : undefined,
            confidence: typeof s.confidence === "number" ? s.confidence : 0.85,
          }));
        if (validSteps.length > 0) {
          return { steps: validSteps };
        }
      }
    }
  } catch (err) {
    // On any gateway error, fall back to the deterministic planner
    console.error("[Planner] LLM Gateway planning failed, falling back to deterministic planner:", err);
  }

  // ─── Deterministic Planning (fallback) ──────────────────────────────────
  return generateDeterministicPlan(taskTitle, taskDescription, employeeRole, employeeTools);
}

/**
 * Deterministic keyword-based planner (fallback when no real LLM is configured).
 */
function generateDeterministicPlan(
  taskTitle: string,
  taskDescription: string,
  employeeRole: string,
  employeeTools: string[]
): ExecutionPlan {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();
  const has = (kw: string[]) => kw.some((k) => text.includes(k));

  // Determine which pattern to use based on keywords
  if (has(["draft", "replies", "queries", "customer", "support", "inbox", "ticket"])) {
    return customerSupportPlan(taskTitle, employeeTools);
  }

  if (has(["research", "prospect", "outreach", "leads", "sales", "cold email", "follow up"])) {
    return salesOutreachPlan(taskTitle, employeeTools);
  }

  if (has(["summarize", "summary", "report", "analysis", "briefing", "digest", "compile"])) {
    return researchPlan(taskTitle, employeeTools);
  }

  // Default: generic plan
  return genericPlan(taskTitle, employeeTools);
}

/**
 * Customer Support pattern:
 * search_knowledge → reasoning → draft_response → send_email (critical) → reasoning
 */
function customerSupportPlan(title: string, tools: string[]): ExecutionPlan {
  const steps: PlannedStep[] = [];

  // Step 1: Search knowledge base (if available)
  if (tools.includes("search_knowledge")) {
    steps.push({
      stepType: "tool_call",
      reasoning: `Searching company documents for relevant policies and FAQs related to: "${title}".`,
      tool: "search_knowledge",
      toolInput: { query: title },
      confidence: 0.94,
    });
  }

  // Step 2: Reasoning about the query
  steps.push({
    stepType: "reasoning",
    reasoning:
      "Found relevant policy information in the company documents. " +
      "The customer's query relates to order status and returns. I will draft a response grounded in the returns policy.",
    confidence: 0.91,
  });

  // Step 3: Draft a response (if available)
  if (tools.includes("draft_response")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "Drafting a response to the customer. The draft cites the 7-day return window from the returns policy and includes the tracking link.",
      tool: "draft_response",
      toolInput: {
        context: "customer order status query",
        policy_ref: "returns-policy.pdf chunk 7",
      },
      confidence: 0.88,
    });
  }

  // Step 4: Send email (critical — always requires approval)
  if (tools.includes("send_email")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "The drafted response is ready to send to the customer. This is a critical action — sending an external email requires human approval before execution.",
      tool: "send_email",
      toolInput: {
        to: "[recipient — to be determined by context]",
        subject: `Re: ${title}`,
        body: "[email body — to be drafted by the employee during execution]",
      },
      confidence: 0.85,
    });
  }

  // Step 5: Post-send reasoning
  steps.push({
    stepType: "reasoning",
    reasoning: "Response sent to the customer. I will monitor for any follow-up queries and process them similarly.",
    confidence: 0.92,
  });

  return { steps };
}

/**
 * Sales Outreach pattern:
 * search_knowledge → reasoning → draft_response → send_email (critical)
 */
function salesOutreachPlan(title: string, tools: string[]): ExecutionPlan {
  const steps: PlannedStep[] = [];

  if (tools.includes("search_knowledge")) {
    steps.push({
      stepType: "tool_call",
      reasoning: `Searching the sales playbook for outreach templates and prospect qualification criteria for: "${title}".`,
      tool: "search_knowledge",
      toolInput: { query: "sales playbook outreach templates prospect qualification" },
      confidence: 0.92,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning:
      "Identified 3 prospects matching the target criteria from the sales playbook. " +
      "I will draft a personalized outreach email for the first prospect, referencing their recent business news.",
    confidence: 0.89,
  });

  if (tools.includes("draft_response")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "Drafting a personalized outreach email. The draft references the prospect's recent expansion and proposes a 20-minute demo.",
      tool: "draft_response",
      toolInput: {
        context: "sales outreach email",
        prospect: "mid-size logistics company",
      },
      confidence: 0.86,
    });
  }

  if (tools.includes("send_email")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "The outreach email is ready to send. This is a critical action — sending an external email to a prospect requires human approval.",
      tool: "send_email",
      toolInput: {
        to: "[prospect — to be determined by context]",
        subject: "[subject — to be drafted by the employee during execution]",
        body: "[email body — to be drafted by the employee during execution]",
      },
      confidence: 0.83,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning: "Outreach email sent. I will follow up in 3 days if no response is received.",
    confidence: 0.90,
  });

  return { steps };
}

/**
 * Research pattern:
 * search_knowledge → reasoning → summarize → draft_response
 */
function researchPlan(title: string, tools: string[]): ExecutionPlan {
  const steps: PlannedStep[] = [];

  if (tools.includes("search_knowledge")) {
    steps.push({
      stepType: "tool_call",
      reasoning: `Searching the knowledge base for existing research and source documents related to: "${title}".`,
      tool: "search_knowledge",
      toolInput: { query: "research analysis market trends competitor" },
      confidence: 0.95,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning:
      "Found 5 relevant source documents. I will analyze the key findings, identify trends, and cross-reference with the competitor analysis document.",
    confidence: 0.93,
  });

  if (tools.includes("summarize")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "Summarizing the findings into a structured brief. The summary covers market trends, competitor moves, and actionable recommendations.",
      tool: "summarize",
      toolInput: {
        sources: "competitor-analysis-q4.docx, industry-report-logistics.txt",
        format: "executive briefing",
      },
      confidence: 0.91,
    });
  }

  if (tools.includes("draft_response")) {
    steps.push({
      stepType: "tool_call",
      reasoning:
        "Drafting the research briefing for leadership review. The draft includes an executive summary, key findings, and recommended next steps.",
      tool: "draft_response",
      toolInput: {
        context: "research briefing for leadership",
        format: "2-page executive summary",
      },
      confidence: 0.89,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning: "Research briefing drafted and ready for review. All sources are cited.",
    confidence: 0.94,
  });

  return { steps };
}

/**
 * Generic pattern: search_knowledge → reasoning → draft_response
 */
function genericPlan(title: string, tools: string[]): ExecutionPlan {
  const steps: PlannedStep[] = [];

  if (tools.includes("search_knowledge")) {
    steps.push({
      stepType: "tool_call",
      reasoning: `Searching the knowledge base for information relevant to: "${title}".`,
      tool: "search_knowledge",
      toolInput: { query: title },
      confidence: 0.90,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning: "Analyzed the available information. I will now draft a response based on the findings.",
    confidence: 0.87,
  });

  if (tools.includes("draft_response")) {
    steps.push({
      stepType: "tool_call",
      reasoning: "Drafting a response based on the task requirements and available knowledge.",
      tool: "draft_response",
      toolInput: { context: title },
      confidence: 0.85,
    });
  }

  if (tools.includes("send_email")) {
    steps.push({
      stepType: "tool_call",
      reasoning: "The response is ready to send. This is a critical action requiring human approval.",
      tool: "send_email",
      toolInput: {
        to: "recipient@example.in",
        subject: title,
        body: `Hello,\n\nThis is a response generated for: ${title}.\n\nBest regards,\nAI Employee`,
      },
      confidence: 0.82,
    });
  }

  steps.push({
    stepType: "reasoning",
    reasoning: "Task completed. All steps executed successfully.",
    confidence: 0.91,
  });

  return { steps };
}

// ─── Mock Tool Execution ─────────────────────────────────────────────────────

/**
 * Executes a non-critical tool and returns its output.
 * This is a mock — in production, each tool would have a real implementation
 * (e.g., search_knowledge queries pgvector, send_email calls the email provider).
 *
 * Per BED-001 §13: "No direct shell or code execution tools — V1 tools are
 * limited to draft_response, send_email, search_knowledge, summarize."
 */
export function executeTool(
  toolName: string,
  toolInput: Record<string, string>
): { output: Record<string, string>; tokens: number; durationMs: number } {
  const start = Date.now();

  switch (toolName) {
    case "search_knowledge":
      return {
        output: {
          result: `Retrieved relevant sections from knowledge base for query: "${toolInput.query || ""}"`,
          chunks: "returns-policy.pdf:chunk3, returns-policy.pdf:chunk7, faq-knowledge-base.md:chunk12",
        },
        tokens: 380,
        durationMs: Date.now() - start + 1200,
      };

    case "draft_response":
      return {
        output: {
          draft: `Drafted response for: ${toolInput.context || "the task"}. The response is grounded in retrieved knowledge and follows the employee's job description.`,
          status: "drafted",
        },
        tokens: 640,
        durationMs: Date.now() - start + 1800,
      };

    case "summarize":
      return {
        output: {
          summary: `Summarized content from sources: ${toolInput.sources || "N/A"}. Key findings: trend 1, trend 2, trend 3.`,
          format: toolInput.format || "summary",
        },
        tokens: 520,
        durationMs: Date.now() - start + 1500,
      };

    case "send_email":
      // send_email is always critical and never auto-executed.
      // If this is called, it means the approval was granted.
      return {
        output: {
          messageId: `msg_${Date.now()}`,
          status: "sent",
          recipient: toolInput.to || "",
        },
        tokens: 100,
        durationMs: Date.now() - start + 500,
      };

    default:
      return {
        output: { result: `Unknown tool: ${toolName}` },
        tokens: 0,
        durationMs: Date.now() - start,
      };
  }
}
