/**
 * OWNARA — Grant Mandate Page
 *
 * The act of ENTRUSTING. Instead of "Create Task" (imperative, one-shot),
 * the grantor declares a DESIRED STATE and confers AUTHORITY to an AI tenant
 * to pursue it continuously.
 *
 * This is the UX that makes the Mandate feel fundamentally different from
 * ordinary SaaS: you are not assigning work, you are entrusting responsibility.
 *
 * Layout:
 *   1. Page Header — "Grant a Mandate"
 *   2. Declaration — title + desired state (declarative, not imperative)
 *   3. Success Criteria — measurable target
 *   4. Authority — autonomous / approval-required / forbidden
 *   5. Tenant — which AI employee executes
 *   6. Summary — what you are entrusting
 *   7. Grant CTA
 */

"use client";

import { useState } from "react";
import { useRouter } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Scroll,
  ShieldCheck,
  Clock,
  Lock,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const TEMPLATES = [
  {
    label: "Maintain Healthy Receivables",
    title: "Maintain Healthy Receivables",
    declaration: "Receivables older than 30 days should remain below 15% of total outstanding, and every overdue invoice should have an active resolution plan.",
    successCriteria: "overdueRate <= 0.15",
    autonomous: ["generate_reminder", "search_knowledge", "update_collection_case"],
    requiresApproval: ["send_reminder", "send_email"],
    forbidden: ["offer_discount_above_10", "send_legal_notice", "write_off_invoice"],
    escalationTriggers: ["disputed_invoice", "customer_bankruptcy", "invoice_over_90_days"],
  },
  {
    label: "Reduce Overdue Receivables",
    title: "Reduce Overdue Receivables",
    declaration: "Actively reduce the overdue receivables balance by 25% month-over-month through structured follow-ups and negotiated payment plans.",
    successCriteria: "overdueRate <= 0.10",
    autonomous: ["generate_reminder", "search_knowledge", "update_collection_case"],
    requiresApproval: ["send_reminder", "send_email", "offer_payment_plan"],
    forbidden: ["write_off_invoice", "send_legal_notice"],
    escalationTriggers: ["customer_unresponsive_30_days", "disputed_invoice"],
  },
  {
    label: "Custom Mandate",
    title: "",
    declaration: "",
    successCriteria: "",
    autonomous: [],
    requiresApproval: [],
    forbidden: [],
    escalationTriggers: [],
  },
];

export function GrantMandatePage() {
  const { navigate } = useRouter();
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [title, setTitle] = useState(TEMPLATES[0].title);
  const [declaration, setDeclaration] = useState(TEMPLATES[0].declaration);
  const [successCriteria, setSuccessCriteria] = useState(TEMPLATES[0].successCriteria);
  const [autonomous, setAutonomous] = useState(TEMPLATES[0].autonomous.join(", "));
  const [requiresApproval, setRequiresApproval] = useState(TEMPLATES[0].requiresApproval.join(", "));
  const [forbidden, setForbidden] = useState(TEMPLATES[0].forbidden.join(", "));
  const [escalationTriggers, setEscalationTriggers] = useState(TEMPLATES[0].escalationTriggers.join(", "));
  const [tenantId, setTenantId] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      api.mandates.grant({
        title,
        declaration,
        successCriteria,
        authoritySpec: {
          autonomous: autonomous.split(",").map((s) => s.trim()).filter(Boolean),
          requiresApproval: requiresApproval.split(",").map((s) => s.trim()).filter(Boolean),
          forbidden: forbidden.split(",").map((s) => s.trim()).filter(Boolean),
          escalationTriggers: escalationTriggers.split(",").map((s) => s.trim()).filter(Boolean),
        },
        tenantId: tenantId || undefined,
      }),
    onSuccess: (data: any) => {
      navigate(`mandates/${data.id}`);
    },
  });

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setTemplate(t);
    setTitle(t.title);
    setDeclaration(t.declaration);
    setSuccessCriteria(t.successCriteria);
    setAutonomous(t.autonomous.join(", "));
    setRequiresApproval(t.requiresApproval.join(", "));
    setForbidden(t.forbidden.join(", "));
    setEscalationTriggers(t.escalationTriggers.join(", "));
  };

  const canGrant = title.trim().length > 3 && declaration.trim().length > 10 && successCriteria.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("mandates")} className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
          <ArrowRight className="h-3.5 w-3.5 rotate-180" /> All Mandates
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
          <Scroll className="h-6 w-6 text-emerald-400" />
          Grant a Mandate
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Entrust a persistent organizational responsibility to an AI employee. Unlike a task, a Mandate pursues a desired state continuously — and survives tenant replacement.
        </p>
      </div>

      {/* Template selector */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Start from a template</div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                template.label === t.label
                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
              )}
            >
              {t.label === "Custom Mandate" ? <Sparkles className="h-3.5 w-3.5" /> : <Scroll className="h-3.5 w-3.5" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Declaration */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center gap-2">
          <Scroll className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Declaration</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Declare the desired state — not an action. The tenant pursues this continuously.</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Maintain Healthy Receivables"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Desired State</label>
            <textarea
              value={declaration}
              onChange={(e) => setDeclaration(e.target.value)}
              rows={3}
              placeholder="Receivables older than 30 days should remain below 15% of total outstanding..."
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Success Criteria (measurable)</label>
            <input
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              placeholder="overdueRate <= 0.15"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-400 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Authority */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Granted Authority</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Define the boundary of trust. What may the tenant do autonomously, what needs your approval, and what is forbidden?</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Autonomous (comma-separated)
            </label>
            <input
              value={autonomous}
              onChange={(e) => setAutonomous(e.target.value)}
              placeholder="generate_reminder, search_knowledge"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <Clock className="h-3 w-3" /> Requires Approval (comma-separated)
            </label>
            <input
              value={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.value)}
              placeholder="send_reminder, send_email"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <Lock className="h-3 w-3" /> Forbidden (comma-separated)
            </label>
            <input
              value={forbidden}
              onChange={(e) => setForbidden(e.target.value)}
              placeholder="send_legal_notice, write_off_invoice"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Sparkles className="h-3 w-3" /> Escalation Triggers (comma-separated)
            </label>
            <input
              value={escalationTriggers}
              onChange={(e) => setEscalationTriggers(e.target.value)}
              placeholder="disputed_invoice, customer_bankruptcy"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Tenant */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-zinc-200">Assign AI Tenant</h3>
        <p className="mt-1 text-xs text-zinc-500">The AI employee who will pursue this Mandate. Replaceable — the Mandate outlives any tenant.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {employees.map((e: any) => (
            <button
              key={e.id}
              onClick={() => setTenantId(e.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                tenantId === e.id
                  ? "border-emerald-600 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700"
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/15 text-[0.6rem] font-bold text-emerald-400">
                {e.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
              </div>
              {e.name}
            </button>
          ))}
          {employees.length === 0 && (
            <p className="text-xs text-zinc-500">No active employees. Grant without a tenant — you can assign one later.</p>
          )}
        </div>
      </div>

      {/* Grant CTA */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-xs text-zinc-400">
          {canGrant ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready to grant — this Mandate will activate immediately
            </span>
          ) : (
            <span>Complete the declaration and success criteria to grant</span>
          )}
        </div>
        <button
          onClick={() => grantMutation.mutate()}
          disabled={!canGrant || grantMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {grantMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Granting…</>
          ) : (
            <><Scroll className="h-4 w-4" /> Grant Mandate</>
          )}
        </button>
      </div>
    </div>
  );
}
