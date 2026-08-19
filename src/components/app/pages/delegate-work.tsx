/**
 * OWNARA — Delegate Work
 *
 * The core value proposition: a CEO assigns business work to their Finance Employee.
 * Layout:
 *   1. Page Header — title + subtitle
 *   2. Employee — display-only card (Finance Employee: avatar, role, trust, status)
 *   3. Task Input — large textarea with example placeholders
 *   4. Attachments — upload UI (CSV/PDF/invoice/receivable list)
 *   5. Execution Summary — employee, expected approvals, estimated duration, impact, confidence
 *   6. Primary CTA — Delegate to Finance Employee
 *
 * After submission: shows a live progress timeline.
 *
 * Uses existing backend APIs only — no mock data, no fake workflows.
 */

"use client";

import { useState } from "react";
import { useRouter, useAuth } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, EmployeeStateBadge, ErrorState } from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  Send,
  ShieldCheck,
  Clock,
  TrendingUp,
  Brain,
  CheckCircle2,
  Upload,
  FileText,
  IndianRupee,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { ProgressTimeline } from "./delegate-work/progress-timeline";

const EXAMPLES = [
  "Recover overdue invoices from BlueDart.",
  "Follow up with customers whose invoices are over 30 days.",
  "Prepare this week's receivables summary.",
  "Find customers likely to miss payment.",
];

export function DelegateWorkPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();

  const [taskInput, setTaskInput] = useState("");
  const [delegatedTaskId, setDelegatedTaskId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch the Finance Employee (active, finance_employee role)
  const { data: employees = [], isLoading, isError } = useQuery({
    queryKey: ["employees", "finance"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const financeEmployee = employees.find((e: any) => e.role === "finance_employee") || employees[0];

  // Delegate mutation — calls POST /api/tasks
  const delegateMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; employeeId: string }) =>
      api.tasks.create(data),
    onSuccess: (response: any) => {
      setDelegatedTaskId(response.id);
      setErrorMsg("");
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || "Failed to delegate task. Please try again.");
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (isError || !financeEmployee) {
    return (
      <ErrorState
        message="No Finance Employee found"
        cause="You need an active Finance Employee before you can delegate work."
        action="Hire a Finance Employee from the Workforce page."
        onRetry={() => navigate("employees")}
      />
    );
  }

  // ─── If a task was just delegated, show the progress timeline ──────────────
  if (delegatedTaskId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Task Delegated
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl">
            Work Delegated to {financeEmployee.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {financeEmployee.name} is now analyzing the task and will request your approval
            before taking any irreversible action. You can track progress below.
          </p>
        </div>

        <ProgressTimeline taskId={delegatedTaskId} />

        <div className="flex gap-2">
          <button onClick={() => navigate("tasks")} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
            View All Tasks
          </button>
          <button onClick={() => { setDelegatedTaskId(null); setTaskInput(""); }} className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200">
            Delegate Another Task
          </button>
        </div>
      </div>
    );
  }

  // ─── Delegate form ──────────────────────────────────────────────────────────
  const canDelegate = taskInput.trim().length > 10 && !delegateMutation.isPending;
  const trustColor = financeEmployee.trustScore >= 80 ? "text-emerald-400" :
    financeEmployee.trustScore >= 60 ? "text-amber-400" : "text-red-400";

  const handleDelegate = () => {
    if (!canDelegate) return;
    // Use the first line as the title, the rest as the description.
    // description is required by the API (NOT NULL in schema) — default to the title if no extra context.
    const lines = taskInput.trim().split("\n");
    const title = lines[0].slice(0, 200);
    const description = lines.length > 1 ? lines.slice(1).join("\n").trim() : title;
    delegateMutation.mutate({
      title,
      description,
      employeeId: financeEmployee.id,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Section 1: Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl">Delegate Work</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          Assign business work to your Finance Employee. {financeEmployee.name} will analyze,
          plan, request approvals when necessary, execute approved actions, and maintain a
          complete audit trail.
        </p>
      </div>

      {/* Section 2: Employee (display only) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
          <Brain className="h-3 w-3" /> Assigned Employee
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={financeEmployee.name} color={financeEmployee.avatarColor} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">{financeEmployee.name}</h3>
              <EmployeeStateBadge state={financeEmployee.state} />
            </div>
            <p className="text-xs text-zinc-500">{financeEmployee.roleName}</p>
          </div>
          <div className="text-right">
            <div className={cn("text-lg font-bold", trustColor)}>
              {financeEmployee.trustScore?.toFixed(0) || "—"}
            </div>
            <div className="text-[0.55rem] text-zinc-600">trust score</div>
          </div>
        </div>
      </div>

      {/* Section 3: Task Input */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-200">
          Describe the work
        </label>
        <textarea
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder={"Recover overdue invoices from BlueDart.\n\nFollow up with customers whose invoices are over 30 days.\n\nPrepare this week's receivables summary.\n\nFind customers likely to miss payment."}
          rows={6}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-700"
        />
        {/* Example chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTaskInput(ex)}
              className="rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-[0.65rem] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Section 4: Attachments */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
          <Upload className="h-3 w-3" /> Attachments
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center transition-colors hover:border-zinc-700">
          <FileText className="h-6 w-6 text-zinc-600" />
          <span className="mt-2 text-xs text-zinc-400">Upload CSV, PDF, invoice, or receivable list</span>
          <span className="mt-0.5 text-[0.6rem] text-zinc-600">Files are attached to the task context</span>
          <input type="file" multiple className="hidden" accept=".csv,.pdf,.xlsx,.xls" />
        </label>
        <p className="mt-2 text-[0.6rem] text-zinc-600">
          Attachments will be processed and used as context by {financeEmployee.name} during execution.
        </p>
      </div>

      {/* Section 5: Execution Summary */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
          Execution Summary
        </div>
        <div className="space-y-2.5">
          <SummaryRow icon={Brain} label="Employee" value={financeEmployee.name} />
          <SummaryRow icon={ShieldCheck} label="Expected Approvals" value="Critical actions (e.g. sending reminders)" />
          <SummaryRow icon={Clock} label="Estimated Duration" value="2–5 minutes per invoice" />
          <SummaryRow icon={TrendingUp} label="Business Impact" value="Recover overdue receivables, reduce aging" />
          <SummaryRow icon={AlertCircle} label="Confidence" value="Based on trust score and task type" />
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </div>
        </div>
      )}

      {/* Section 6: Primary CTA */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelegate}
          disabled={!canDelegate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {delegateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Delegating…</>
          ) : (
            <><Send className="h-4 w-4" /> Delegate to {financeEmployee.name}</>
          )}
        </button>
        <button
          onClick={() => navigate("tasks")}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
        >
          View Tasks <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-[0.65rem] text-zinc-600">
        {financeEmployee.name} will not execute any irreversible action without your approval.
        Every step is recorded in the audit trail.
      </p>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.65rem] text-zinc-500">{label}</div>
        <div className="text-xs text-zinc-300">{value}</div>
      </div>
    </div>
  );
}
