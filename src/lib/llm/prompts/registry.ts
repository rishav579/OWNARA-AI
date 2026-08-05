/**
 * BIHARI AI — Prompt Registry
 *
 * A versioned prompt management system that:
 * - Stores prompt templates with versioning
 * - Supports rollback (activate a previous version)
 * - Loads prompts from files (src/lib/llm/prompts/*.json)
 * - Tracks metadata (task type, variables, JSON schema)
 * - Provides template variable interpolation
 *
 * Prompts are loaded from JSON files at startup and cached in memory.
 * The registry is a singleton — all employees share the same prompt templates.
 *
 * File format (e.g., src/lib/llm/prompts/planning.v1.json):
 * {
 *   "id": "planning",
 *   "version": 1,
 *   "name": "Task Planning",
 *   "description": "Generates an execution plan for a task",
 *   "taskType": "planning",
 *   "systemPrompt": "You are an AI Employee...",
 *   "userPromptTemplate": "Task: {{title}}\nDescription: {{description}}\n...",
 *   "variables": ["title", "description", "role", "tools"],
 *   "jsonSchema": { ... }  // optional — for JSON mode validation
 * }
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { PromptTemplate, PromptInvocation, TaskType } from "../types";

// Re-export so callers can import PromptInvocation from this module.
export type { PromptInvocation };

// ─── Registry ────────────────────────────────────────────────────────────────

export class PromptRegistry {
  private templates: Map<string, PromptTemplate[]> = new Map();
  private loaded = false;

  /**
   * Loads all prompt templates from the prompts directory.
   * Called once at startup (lazy-loaded on first access).
   */
  load(): void {
    if (this.loaded) return;

    const promptsDir = join(process.cwd(), "src", "lib", "llm", "prompts");

    if (!existsSync(promptsDir)) {
      // Create directory structure by seeding default prompts
      this.seedDefaults();
      this.loaded = true;
      return;
    }

    const files = readdirSync(promptsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = readFileSync(join(promptsDir, file), "utf-8");
        const template = JSON.parse(content) as PromptTemplate;
        this.register(template);
      } catch (err) {
        console.error(`[PromptRegistry] Failed to load ${file}:`, err);
      }
    }

    // If no prompts were loaded, seed defaults
    if (this.templates.size === 0) {
      this.seedDefaults();
    }

    this.loaded = true;
  }

  /**
   * Registers a prompt template. If a template with the same ID and version
   * exists, it is overwritten.
   */
  register(template: PromptTemplate): void {
    const existing = this.templates.get(template.id) || [];
    const existingIdx = existing.findIndex((t) => t.version === template.version);

    if (existingIdx >= 0) {
      existing[existingIdx] = template;
    } else {
      existing.push(template);
    }

    // Sort by version descending (newest first)
    existing.sort((a, b) => b.version - a.version);
    this.templates.set(template.id, existing);
  }

  /**
   * Gets the active version of a prompt template.
   */
  get(promptId: string): PromptTemplate | null {
    this.load();
    const versions = this.templates.get(promptId);
    if (!versions || versions.length === 0) return null;
    // Return the first active version, or the newest
    return versions.find((t) => t.active) || versions[0];
  }

  /**
   * Gets a specific version of a prompt template.
   */
  getVersion(promptId: string, version: number): PromptTemplate | null {
    this.load();
    const versions = this.templates.get(promptId);
    if (!versions) return null;
    return versions.find((t) => t.version === version) || null;
  }

  /**
   * Gets all versions of a prompt template.
   */
  getVersions(promptId: string): PromptTemplate[] {
    this.load();
    return this.templates.get(promptId) || [];
  }

  /**
   * Rolls back to a specific version by activating it and deactivating others.
   */
  rollback(promptId: string, version: number): boolean {
    this.load();
    const versions = this.templates.get(promptId);
    if (!versions) return false;

    let found = false;
    for (const t of versions) {
      if (t.version === version) {
        t.active = true;
        found = true;
      } else {
        t.active = false;
      }
    }
    return found;
  }

  /**
   * Lists all registered prompt IDs.
   */
  list(): string[] {
    this.load();
    return Array.from(this.templates.keys());
  }

  /**
   * Renders a prompt template by interpolating variables.
   * Returns the system prompt and user prompt as a ready-to-use message pair.
   */
  render(invocation: PromptInvocation): { systemPrompt: string; userPrompt: string } | null {
    const template = this.getVersion(invocation.promptId, invocation.version) || this.get(invocation.promptId);
    if (!template) return null;

    const systemPrompt = template.systemPrompt;
    let userPrompt = template.userPromptTemplate;

    // Interpolate variables
    for (const [key, value] of Object.entries(invocation.variables)) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    return { systemPrompt, userPrompt };
  }

  /**
   * Seeds default prompt templates when no files exist.
   */
  private seedDefaults(): void {
    const defaults: PromptTemplate[] = [
      {
        id: "planning",
        version: 1,
        name: "Task Planning",
        description: "Generates an execution plan for a task based on the task description, employee role, and available tools.",
        taskType: "planning",
        systemPrompt: `You are an AI Employee. Your job is to create an execution plan for the given task.
Break the task into sequential steps. Each step is either:
- "reasoning": Think about what to do next
- "tool_call": Execute a tool (search_knowledge, draft_response, send_email, summarize)

For tools that are critical (send_email), mark them as requiring approval.
Return your plan as JSON with the following structure:
{
  "reasoning": "Brief explanation of the plan",
  "steps": [
    { "stepType": "reasoning", "reasoning": "...", "confidence": 0.95 },
    { "stepType": "tool_call", "reasoning": "...", "tool": "search_knowledge", "toolInput": { "query": "..." }, "confidence": 0.92 }
  ]
}`,
        userPromptTemplate: `Task: {{title}}
Description: {{description}}
Employee Role: {{role}}
Available Tools: {{tools}}

Create an execution plan for this task.`,
        variables: ["title", "description", "role", "tools"],
        createdAt: new Date(),
        active: true,
      },
      {
        id: "finance_reasoning",
        version: 1,
        name: "Finance Reasoning",
        description: "Produces a structured finance recommendation based on invoice context, customer history, and policies.",
        taskType: "finance_reasoning",
        systemPrompt: `You are an experienced Accounts Receivable Manager. Analyze the provided invoice context and produce a collection recommendation.

Consider:
- Invoice aging and outstanding amount
- Customer risk level and payment history
- Previous reminders and customer responses
- Company policies that apply
- Your memory of past interactions with this customer

Return your recommendation as JSON:
{
  "action": "send_first_reminder | send_follow_up_reminder | escalate_to_manager | escalate_to_legal | mark_for_write_off | monitor | no_action",
  "confidence": 0.85,
  "reasoning": "Detailed explanation of WHY this action was chosen"
}`,
        userPromptTemplate: `Invoice: {{invoiceNumber}}
Customer: {{customerName}} (Risk: {{riskLevel}})
Outstanding: {{outstanding}}
Days Overdue: {{daysOverdue}}
Aging Bucket: {{agingBucket}}
Previous Reminders: {{previousReminders}}
Customer Response: {{customerResponse}}

Analyze this invoice and recommend a collection action.`,
        variables: ["invoiceNumber", "customerName", "riskLevel", "outstanding", "daysOverdue", "agingBucket", "previousReminders", "customerResponse"],
        createdAt: new Date(),
        active: true,
      },
      {
        id: "drafting",
        version: 1,
        name: "Response Drafting",
        description: "Drafts a response or reminder email based on the context and recommended action.",
        taskType: "drafting",
        systemPrompt: `You are an AI Employee drafting a professional communication.
The tone should match the recommended action:
- First reminder: friendly, professional
- Follow-up: firm but respectful
- Escalation: serious, with consequences
- Legal: formal, final notice

Return the draft as JSON:
{
  "subject": "Email subject line",
  "body": "Email body text"
}`,
        userPromptTemplate: `Recipient: {{customerName}}
Invoice: {{invoiceNumber}}
Amount: {{amount}}
Days Overdue: {{daysOverdue}}
Recommended Action: {{action}}
Due Date: {{dueDate}}

Draft a reminder email for this invoice.`,
        variables: ["customerName", "invoiceNumber", "amount", "daysOverdue", "action", "dueDate"],
        createdAt: new Date(),
        active: true,
      },
      {
        id: "summarization",
        version: 1,
        name: "Content Summarization",
        description: "Summarizes long content into a structured brief.",
        taskType: "summarization",
        systemPrompt: `You are an AI Employee summarizing content for a business briefing.
Produce a concise, actionable summary with key findings and recommendations.

Return as JSON:
{
  "summary": "Executive summary (2-3 sentences)",
  "keyFindings": ["Finding 1", "Finding 2"],
  "recommendations": ["Recommendation 1"]
}`,
        userPromptTemplate: `Sources: {{sources}}
Format: {{format}}

Summarize the following content:

{{content}}`,
        variables: ["sources", "format", "content"],
        createdAt: new Date(),
        active: true,
      },
    ];

    for (const template of defaults) {
      this.register(template);
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let registryInstance: PromptRegistry | null = null;

export function getPromptRegistry(): PromptRegistry {
  if (!registryInstance) {
    registryInstance = new PromptRegistry();
  }
  return registryInstance;
}
