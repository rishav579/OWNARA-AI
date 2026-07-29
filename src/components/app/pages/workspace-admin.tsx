"use client";

import { useState } from "react";
import { api } from "@/lib/app/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  Avatar,
  ErrorState,
  ListSkeleton,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  Shield,
  Plug,
  Scale,
  Mail,
  MoreVertical,
} from "lucide-react";

const TABS = [
  { id: "members", label: "Members", icon: Users },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "policies", label: "Policies", icon: Scale },
  { id: "integrations", label: "Integrations", icon: Plug },
] as const;

export function WorkspaceAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("members");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["workspace-admin"],
    queryFn: () => api.workspaceAdmin.get(),
  });

  if (isLoading) return (
    <div>
      <PageHeader title="Workspace Administration" description="Manage members, departments, and workspace configuration" />
      <ListSkeleton rows={5} />
    </div>
  );
  if (isError || !data) return (
    <div>
      <PageHeader title="Workspace Administration" description="Manage members, departments, and workspace configuration" />
      <ErrorState message="Failed to load workspace data" onRetry={() => refetch()} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Workspace Administration"
        description="Manage members, departments, and workspace configuration"
      />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Users className="h-3.5 w-3.5" /> Members</div>
          <div className="mt-1 text-xl font-bold text-zinc-50">{data.stats.memberCount}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Building2 className="h-3.5 w-3.5" /> Departments</div>
          <div className="mt-1 text-xl font-bold text-zinc-50">{data.stats.departmentCount}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Scale className="h-3.5 w-3.5" /> Active Policies</div>
          <div className="mt-1 text-xl font-bold text-zinc-50">{data.stats.activePolicies}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Plug className="h-3.5 w-3.5" /> Integrations</div>
          <div className="mt-1 text-xl font-bold text-zinc-50">{data.stats.connectedIntegrations}</div>
        </div>
      </div>

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

      {tab === "members" && (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-zinc-100">Workspace Members</h3>
            <button className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400">
              <Mail className="h-3.5 w-3.5" /> Invite
            </button>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {data.members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={m.name} color={m.avatarColor} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{m.name}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase",
                      m.role === "owner" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
                    )}>
                      {m.role}
                    </span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">{m.email}</div>
                </div>
                <span className="hidden text-xs text-zinc-500 sm:block">Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                <button className="text-zinc-500 hover:text-zinc-300">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "departments" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.departments.map((d: any) => (
            <div key={d.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-zinc-100">{d.name}</h4>
                  <p className="mt-0.5 text-xs text-zinc-400">{d.description || "No description"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "policies" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <Scale className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">
            {data.stats.activePolicies} active policies. Manage them in the <span className="text-emerald-400">Governance</span> tab.
          </p>
        </div>
      )}

      {tab === "integrations" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <Plug className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">
            {data.stats.connectedIntegrations} integrations connected. Manage them in the <span className="text-emerald-400">Integrations</span> tab.
          </p>
        </div>
      )}
    </div>
  );
}
