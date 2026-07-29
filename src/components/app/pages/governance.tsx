"use client";

import { useState } from "react";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  SeverityBadge,
  ErrorState,
  ListSkeleton,
  EmptyState,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  Scale,
  Plus,
  Search,
  Shield,
  GitBranch,
  Users,
  Zap,
  X,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ArrowUp,
} from "lucide-react";

const TABS = [
  { id: "policies", label: "Policy Library", icon: Scale },
  { id: "rules", label: "Approval Rules", icon: GitBranch },
  { id: "roles", label: "Roles & Permissions", icon: Users },
  { id: "automation", label: "Automation Rules", icon: Zap },
] as const;

const CATEGORIES = ["all", "financial", "data_access", "communication", "escalation", "compliance"];

export function GovernancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("policies");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <PageHeader
        title="Governance"
        description="Policies, approval rules, and permissions that govern AI Employee behavior"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Policy</span>
          </button>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 sm:w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "policies" && <PoliciesTab category={category} setCategory={setCategory} query={query} setQuery={setQuery} />}
      {tab === "rules" && <RulesTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "automation" && <AutomationTab />}

      {showCreate && <CreatePolicyModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function PoliciesTab({ category, setCategory, query, setQuery }: { category: string; setCategory: (v: string) => void; query: string; setQuery: (v: string) => void }) {
  const queryClient = useQueryClient();
  const { data: policies = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["policies", category],
    queryFn: () => api.governance.policies({ category, status: "active" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.governance.archivePolicy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["policies"] }),
  });

  const filtered = policies.filter((p: any) => {
    if (query && !p.name.toLowerCase().includes(query.toLowerCase()) && !p.code.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState message="Failed to load policies" onRetry={() => refetch()} />;

  return (
    <div>
      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                category === c ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {c === "all" ? "All" : c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search policies…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Scale} title="No policies found" description="Create your first governance policy to control AI Employee behavior." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-violet-400">{p.code}</span>
                    <SeverityBadge severity={p.severity} />
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-zinc-100">{p.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Shield className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium text-zinc-400 capitalize">{p.category.replace(/_/g, " ")}</span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-500">{p.rules.length} rules</span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-500">Applies to: {p.appliesTo === "all" ? "All roles" : p.appliesTo.replace("role:", "")}</span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="text-[0.65rem] text-zinc-500">Created {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                <button
                  onClick={() => archiveMutation.mutate(p.id)}
                  className="text-xs text-zinc-500 transition-colors hover:text-red-400"
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesTab() {
  const { data: rules = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["rules"],
    queryFn: () => api.governance.rules(),
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState message="Failed to load approval rules" onRetry={() => refetch()} />;

  const actionConfig: Record<string, { cls: string; icon: typeof Lock }> = {
    require_approval: { cls: "bg-amber-500/15 text-amber-400", icon: Lock },
    auto_approve: { cls: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
    auto_reject: { cls: "bg-red-500/15 text-red-400", icon: Ban },
    escalate: { cls: "bg-violet-500/15 text-violet-400", icon: AlertTriangle },
  };

  return (
    <div className="space-y-2">
      {rules.length === 0 ? (
        <EmptyState icon={GitBranch} title="No approval rules" description="Create rules to automate approval decisions." />
      ) : (
        rules.map((r: any) => {
          const ActionIcon = actionConfig[r.action]?.icon || Lock;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                <GitBranch className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{r.name}</span>
                  <span className="font-mono text-[0.65rem] text-zinc-500">priority {r.priority}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-mono rounded bg-zinc-800 px-1.5 py-0.5">{r.trigger}</span>
                  <span>→</span>
                  <span className="font-mono text-zinc-400">{r.condition.field} {r.condition.op} {String(r.condition.value)}</span>
                </div>
              </div>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", actionConfig[r.action]?.cls)}>
                <ActionIcon className="h-3 w-3" />
                {r.action.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-zinc-500">{r.approverRole}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function RolesTab() {
  const roles = [
    { name: "Workspace Owner", description: "Full access. Can manage members, policies, billing, and all AI Employees.", permissions: ["all"], memberCount: 1, color: "#10b981" },
    { name: "Administrator", description: "Manage AI Employees, approve actions, view audit trail. Cannot manage billing.", permissions: ["employees.*", "approvals.*", "audit.read", "knowledge.*"], memberCount: 0, color: "#f59e0b" },
    { name: "Manager", description: "Approve actions, assign tasks, view dashboards. Cannot manage employees or policies.", permissions: ["approvals.*", "tasks.create", "dashboard.read"], memberCount: 0, color: "#8b5cf6" },
    { name: "Auditor", description: "Read-only access to audit trail, dashboards, and employee activity. No write access.", permissions: ["audit.read", "dashboard.read", "employees.read"], memberCount: 0, color: "#0ea5e9" },
    { name: "Member", description: "Assign tasks and approve actions within their department.", permissions: ["tasks.create", "approvals.approve"], memberCount: 0, color: "#64748b" },
  ];

  return (
    <div className="space-y-3">
      {roles.map((r) => (
        <div key={r.name} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">{r.name}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <span key={p} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-400">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
              {r.memberCount} {r.memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AutomationTab() {
  const automations = [
    { name: "Auto-approve knowledge searches", trigger: "When tool = search_knowledge", action: "Auto-approve", enabled: true, runs: 312 },
    { name: "Auto-approve low-risk drafts", trigger: "When risk < 30 AND tool = draft_response", action: "Auto-approve", enabled: true, runs: 184 },
    { name: "Escalate legal threats", trigger: "When content matches /legal|lawyer|sue/", action: "Escalate to owner", enabled: true, runs: 2 },
    { name: "Block competitor contacts", trigger: "When recipient_domain in competitor_blocklist", action: "Auto-reject", enabled: true, runs: 5 },
    { name: "Notify Slack on approval", trigger: "When approval_status = pending", action: "Send Slack notification", enabled: false, runs: 0 },
    { name: "Weekly trust report", trigger: "Every Monday 9:00 AM IST", action: "Generate trust score report", enabled: true, runs: 4 },
  ];

  return (
    <div className="space-y-2">
      {automations.map((a) => (
        <div key={a.name} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", a.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500")}>
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">{a.name}</span>
              {a.enabled && <span className="flex items-center gap-1 text-[0.6rem] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span>}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">{a.trigger} → {a.action}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-medium text-zinc-300">{a.runs}</div>
            <div className="text-[0.6rem] text-zinc-500">runs</div>
          </div>
          <button className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", a.enabled ? "bg-emerald-500" : "bg-zinc-700")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", a.enabled ? "translate-x-4" : "translate-x-0.5")} />
          </button>
        </div>
      ))}
    </div>
  );
}

function CreatePolicyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", category: "financial", description: "", severity: "high", appliesTo: "all" });

  const mutation = useMutation({
    mutationFn: (data: any) => api.governance.createPolicy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-50">Create Policy</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Policy name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Refund Authorization Limit"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="POL-009"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              >
                <option value="financial">Financial</option>
                <option value="data_access">Data Access</option>
                <option value="communication">Communication</option>
                <option value="escalation">Escalation</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what this policy enforces…"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Applies to</label>
              <select
                value={form.appliesTo}
                onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              >
                <option value="all">All roles</option>
                <option value="role:customer_support_agent">Customer Support Agent</option>
                <option value="role:sales_development_representative">Sales Development Rep</option>
                <option value="role:research_analyst">Research Analyst</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-6 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button
            onClick={() => mutation.mutate({ ...form, rules: [] })}
            disabled={mutation.isPending || !form.name}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
