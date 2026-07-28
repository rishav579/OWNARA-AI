"use client";

import { useState } from "react";
import { useRouter, formatDate, formatBytes } from "@/lib/app/router";
import { api } from "@/lib/app/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  DocumentStatusBadge,
  Avatar,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  FileCode,
  Trash2,
  X,
  CloudUpload,
  Database,
} from "lucide-react";

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.includes("sheet")) return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  if (contentType.includes("markdown") || contentType.includes("text")) return <FileCode className="h-5 w-5 text-sky-400" />;
  return <FileText className="h-5 w-5 text-amber-400" />;
}

export function KnowledgePage() {
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [filterEmp, setFilterEmp] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["knowledge", filterEmp],
    queryFn: () => api.knowledge.list({ employeeId: filterEmp !== "all" ? filterEmp : undefined }),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", "active"],
    queryFn: () => api.employees.list({ status: "active" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.knowledge.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  const filtered = docs.filter((d: any) => {
    if (query && !d.filename.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description={`${docs.filter((d: any) => d.status === "ready").length} documents ready · ${docs.filter((d: any) => d.status === "processing").length} processing`}
        actions={
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Document</span>
            <span className="sm:hidden">Upload</span>
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
        </div>
        <select
          value={filterEmp}
          onChange={(e) => setFilterEmp(e.target.value)}
          className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 outline-none focus:border-zinc-700"
        >
          <option value="all">All employees</option>
          {employees.map((e: any) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Failed to load documents" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No documents found"
          description="Upload PDFs, text, or markdown files to ground your AI Employees' responses."
          action={
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              <Upload className="h-4 w-4" /> Upload Document
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Document</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 sm:table-cell">Scoped to</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 md:table-cell">Chunks</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Status</th>
                <th className="hidden px-4 py-2.5 text-xs font-semibold text-zinc-400 lg:table-cell">Uploaded</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-zinc-800/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
                        <FileIcon contentType={d.contentType} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-200">{d.filename}</div>
                        <div className="text-xs text-zinc-500">{formatBytes(d.sizeBytes)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {d.employeeName ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={d.employeeName} color="#10b981" size="sm" />
                        <span className="text-xs text-zinc-300">{d.employeeName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">Workspace</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="font-mono text-xs text-zinc-400">{d.chunkCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={d.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-zinc-500 lg:table-cell">
                    {formatDate(d.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="text-zinc-500 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-50">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-zinc-400 hover:text-zinc-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Scope to employee</label>
                <select className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                  <option value="">Workspace (shared)</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.roleName}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950/50 p-8 text-center">
                <CloudUpload className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-2 text-sm font-medium text-zinc-300">Drop file here or click to browse</p>
                <p className="mt-1 text-xs text-zinc-500">PDF, TXT, MD, DOCX up to 10 MB</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  Documents are chunked and embedded for AI Employee retrieval. PII is access-controlled.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-800 px-6 py-3">
              <button onClick={() => setShowUpload(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button onClick={() => setShowUpload(false)} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
