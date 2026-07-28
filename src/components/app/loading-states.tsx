"use client";

import { cn } from "@/lib/utils";

// ─── Full-screen loading ─────────────────────────────────────────────────────

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-lg shadow-emerald-500/30 animate-pulse">
          B
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

// ─── Card skeleton ───────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-5", className)}>
      <div className="space-y-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Stat card skeleton ─────────────────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-800" />
      </div>
      <div className="mt-3 h-7 w-16 animate-pulse rounded bg-zinc-800" />
    </div>
  );
}

// ─── List skeleton ───────────────────────────────────────────────────────────

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Table skeleton ──────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="border-b border-zinc-800 px-4 py-2.5">
        <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="divide-y divide-zinc-800/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800" />
              <div className="h-2.5 w-1/4 animate-pulse rounded bg-zinc-800" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart skeleton ──────────────────────────────────────────────────────────

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/50 p-5", className)}>
      <div className="mb-4 h-3 w-1/4 animate-pulse rounded bg-zinc-800" />
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-zinc-800"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Employee grid skeleton ──────────────────────────────────────────────────

export function EmployeeGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 animate-pulse rounded-lg bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-zinc-800" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-16 animate-pulse rounded-full bg-zinc-800" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full animate-pulse rounded bg-zinc-800" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-500/30 bg-red-500/5 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-zinc-200">{message}</h3>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}

// ─── Page skeleton (full page loading) ───────────────────────────────────────

export function PageSkeleton({ variant = "list" }: { variant?: "list" | "dashboard" | "grid" | "table" }) {
  if (variant === "dashboard") {
    return (
      <div>
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-800" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ChartSkeleton className="lg:col-span-2" />
          <CardSkeleton />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    );
  }
  if (variant === "grid") {
    return (
      <div>
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-800" />
        <EmployeeGridSkeleton />
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div>
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-800" />
        <TableSkeleton />
      </div>
    );
  }
  return (
    <div>
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-800" />
      <ListSkeleton />
    </div>
  );
}
