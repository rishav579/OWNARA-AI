"use client";

import { useState } from "react";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  IntegrationStatusBadge,
  ErrorState,
  ListSkeleton,
  EmptyState,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import { Plug, Search, Check, X } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  accounting: "Accounting & Finance",
  communication: "Communication",
  crm: "CRM",
  erp: "ERP",
};

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: integrations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.integrations.list(),
  });

  const connectMutation = useMutation({
    mutationFn: (id: string) => api.integrations.connect(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.integrations.disconnect(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const filtered = integrations.filter((i: any) => {
    if (query && !i.displayName.toLowerCase().includes(query.toLowerCase()) && !i.provider.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const categories = Array.from(new Set(integrations.map((i: any) => i.category)));
  const connectedCount = integrations.filter((i: any) => i.status === "connected").length;

  if (isLoading) return (
    <div>
      <PageHeader title="Integrations" description="Connect BIHARI AI to your business tools" />
      <ListSkeleton rows={6} />
    </div>
  );
  if (isError) return (
    <div>
      <PageHeader title="Integrations" description="Connect BIHARI AI to your business tools" />
      <ErrorState message="Failed to load integrations" onRetry={() => refetch()} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Integrations"
        description={`${connectedCount} connected · ${integrations.length} available`}
      />

      {/* Search */}
      <div className="mb-5 relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
          className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Plug} title="No integrations found" />
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const catIntegrations = filtered.filter((i: any) => i.category === cat);
            if (catIntegrations.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
                  {CATEGORY_LABELS[cat as string] || cat}
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[0.65rem] text-zinc-500">{catIntegrations.length}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catIntegrations.map((i: any) => (
                    <div key={i.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold text-white"
                            style={{ backgroundColor: i.logoColor }}
                          >
                            {i.displayName[0]}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-zinc-100">{i.displayName}</h4>
                            <IntegrationStatusBadge status={i.status} />
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{i.description}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
                        {i.status === "connected" ? (
                          <>
                            <span className="text-[0.65rem] text-zinc-500">
                              Connected {i.connectedAt && new Date(i.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                            <button
                              onClick={() => disconnectMutation.mutate(i.id)}
                              disabled={disconnectMutation.isPending}
                              className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" /> Disconnect
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[0.65rem] text-zinc-500">Not connected</span>
                            <button
                              onClick={() => connectMutation.mutate(i.id)}
                              disabled={connectMutation.isPending}
                              className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" /> {connectMutation.isPending ? "Connecting…" : "Connect"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

