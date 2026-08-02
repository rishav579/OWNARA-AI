"use client";

import { cn } from "@/lib/utils";
import type {
  EmployeeStatus,
  EmployeeState,
  TaskStatus,
  ApprovalStatus,
  DocumentStatus,
} from "@/lib/app/data";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Inbox,
  Scale,
  type LucideIcon,
} from "lucide-react";

// ─── Employee Status Badge ───────────────────────────────────────────────────

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const config = {
    draft: { label: "Draft", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400" },
    active: { label: "Active", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
    paused: { label: "Paused", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
    retired: { label: "Retired", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", dot: "bg-zinc-600" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

// ─── Employee State Badge ────────────────────────────────────────────────────

export function EmployeeStateBadge({ state }: { state: EmployeeState }) {
  const config: Record<EmployeeState, { label: string; cls: string }> = {
    idle: { label: "Idle", cls: "text-zinc-400" },
    assigned: { label: "Assigned", cls: "text-sky-400" },
    planning: { label: "Planning", cls: "text-violet-400" },
    executing: { label: "Executing", cls: "text-emerald-400" },
    waiting_approval: { label: "Waiting Approval", cls: "text-amber-400" },
    completed: { label: "Completed", cls: "text-emerald-400" },
    failed: { label: "Failed", cls: "text-red-400" },
    paused: { label: "Paused", cls: "text-amber-400" },
    stopped: { label: "Stopped", cls: "text-zinc-400" },
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", config.cls)}>
      {(state === "executing" || state === "planning") && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}

// ─── Task Status Badge ───────────────────────────────────────────────────────

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = {
    queued: { label: "Queued", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
    assigned: { label: "Assigned", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    planning: { label: "Planning", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    executing: { label: "Executing", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    waiting_approval: { label: "Waiting Approval", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-500/80 border-emerald-500/20" },
    failed: { label: "Failed", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    paused: { label: "Paused", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    stopped: { label: "Stopped", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
  }[status] || { label: status, cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.cls)}>
      {config.label}
    </span>
  );
}

// ─── Approval Status Badge ───────────────────────────────────────────────────

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const config = {
    pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    modified: { label: "Modified", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    expired: { label: "Expired", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.cls)}>
      {config.label}
    </span>
  );
}

// ─── Document Status Badge ───────────────────────────────────────────────────

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = {
    processing: { label: "Processing", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
    ready: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    failed: { label: "Failed", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    removed: { label: "Removed", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.cls)}>
      {status === "processing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
      )}
      {config.label}
    </span>
  );
}

// ─── Priority Badge ──────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: "low" | "medium" | "high" }) {
  const config = {
    low: { label: "Low", cls: "text-zinc-400" },
    medium: { label: "Medium", cls: "text-amber-400" },
    high: { label: "High", cls: "text-red-400" },
  }[priority];
  return <span className={cn("text-xs font-medium", config.cls)}>{config.label}</span>;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const sizes = {
    sm: "h-7 w-7 text-[0.65rem]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-bold text-white",
        sizes[size]
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  accent = "emerald",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  accent?: "emerald" | "amber" | "violet" | "sky";
}) {
  const accentMap = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    violet: "text-violet-400 bg-violet-500/10",
    sky: "text-sky-400 bg-sky-500/10",
  };
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendCls = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-400";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentMap[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-zinc-50">{value}</span>
        {trend && trendValue && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendCls)}>
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-300">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Sparkline (SVG) ─────────────────────────────────────────────────────────

export function Sparkline({
  data,
  color = "#10b981",
  height = 60,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const width = 100;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const gradId = `spark-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Bar Chart (SVG) ─────────────────────────────────────────────────────────

export function BarChart({
  data,
  color = "#10b981",
  height = 160,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 24);
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end gap-1.5">
            <div className="absolute -top-6 hidden whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[0.65rem] text-zinc-300 group-hover:block z-10">
              {d.value}
            </div>
            <div
              className="w-full rounded-t transition-all hover:opacity-80"
              style={{
                height: `${h}px`,
                backgroundColor: color,
                minHeight: d.value > 0 ? "3px" : "0",
              }}
            />
            <span className="text-[0.6rem] text-zinc-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut Chart (SVG) ───────────────────────────────────────────────────────

export function DonutChart({
  data,
  size = 140,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  // Compute cumulative offsets purely via reduce (no mutation during render)
  const offsets = data.reduce<number[]>((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1] + data[i - 1].value : 0;
    return [...acc, prev];
  }, []);

  const segments = data.map((d, i) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    return (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={d.color}
        strokeWidth="10"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-((offsets[i] / total) * circumference)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="butt"
      />
    );
  });
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {segments}
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-zinc-50 text-lg font-bold"
        >
          {total >= 1000000 ? `${(total / 1000000).toFixed(1)}M` : `${(total / 1000).toFixed(0)}K`}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="fill-zinc-500 text-[0.6rem]">
          usage
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-zinc-300">{d.name}</span>
            <span className="ml-auto font-mono text-zinc-500">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max,
  color = "#10b981",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Criticality Badge ───────────────────────────────────────────────────────

export function CriticalityBadge({ criticality }: { criticality: "critical" | "non_critical" }) {
  if (criticality === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-400">
        Critical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-500">
      Non-critical
    </span>
  );
}

// ─── Hash display ────────────────────────────────────────────────────────────

export function HashDisplay({ hash }: { hash: string }) {
  return (
    <span className="font-mono text-[0.65rem] text-zinc-500" title={hash}>
      {hash.slice(0, 10)}…{hash.slice(-6)}
    </span>
  );
}

// Re-export loading/skeleton components for convenience
export { ErrorState, ListSkeleton, TableSkeleton, EmployeeGridSkeleton, StatCardSkeleton, CardSkeleton, ChartSkeleton, PageSkeleton, LoadingScreen } from './loading-states';

// ─── Phase 3: Enterprise UI Primitives ───────────────────────────────────────

// Risk Score Gauge — circular gauge 0-100
export function RiskScoreGauge({ score, size = 64 }: { score: number; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 100, 1);
  const dash = pct * circumference;
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#10b981";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-zinc-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
        <span className="text-[0.55rem] text-zinc-500">risk</span>
      </div>
    </div>
  );
}

// Confidence Bar — 0.0 to 1.0
export function ConfidenceBar({ value, label = "Confidence" }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "#10b981" : value >= 0.7 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono font-medium" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// Trust Score Badge — large number with trend
export function TrustScoreBadge({ score, trend, delta }: { score: number; trend: string; delta: number }) {
  const color = score >= 90 ? "#10b981" : score >= 75 ? "#f59e0b" : "#ef4444";
  const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : "■";
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${trendColor}`}>
          {trendIcon} {Math.abs(delta).toFixed(1)}
        </span>
        <span className="text-[0.6rem] text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

// Policy Badge — references a policy code
export function PolicyBadge({ code, name }: { code: string; name?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300">
      <Scale className="h-3 w-3" />
      <span className="font-mono">{code}</span>
      {name && <span className="text-violet-400/70">· {name}</span>}
    </span>
  );
}

// Severity Badge — for policies
export function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, string> = {
    low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    medium: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide", config[severity] || config.medium)}>
      {severity}
    </span>
  );
}

// Business Impact Block
export function BusinessImpactBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
        <TrendingUp className="h-3.5 w-3.5" /> Business Impact
      </div>
      <p className="text-xs leading-relaxed text-zinc-300">{text}</p>
    </div>
  );
}

// Category Badge — for activity feed
export function CategoryBadge({ category }: { category: string }) {
  const config: Record<string, string> = {
    approval: "bg-amber-500/10 text-amber-400",
    task: "bg-sky-500/10 text-sky-400",
    employee: "bg-emerald-500/10 text-emerald-400",
    financial: "bg-violet-500/10 text-violet-400",
    policy: "bg-red-500/10 text-red-400",
    system: "bg-zinc-500/10 text-zinc-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide", config[category] || config.system)}>
      {category}
    </span>
  );
}

// Severity Dot — for activity feed
export function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "critical" ? "bg-red-500" : severity === "warning" ? "bg-amber-500" : severity === "success" ? "bg-emerald-500" : "bg-zinc-500";
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />;
}

// Explainability Step Type Badge
export function StepTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    observed: { label: "Observed", cls: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
    plan: { label: "Planned", cls: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
    reasoning: { label: "Reasoned", cls: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
    policy_check: { label: "Policy Checked", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    knowledge_used: { label: "Knowledge Used", cls: "bg-teal-500/10 text-teal-400 border-teal-500/30" },
    tool_call: { label: "Tool Executed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    approval_gate: { label: "Waiting Approval", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  };
  const c = config[type] || { label: type, cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide", c.cls)}>
      {c.label}
    </span>
  );
}

// Integration Status Badge
export function IntegrationStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    connected: { label: "Connected", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    available: { label: "Available", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
    error: { label: "Error", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const c = config[status] || config.available;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", c.cls)}>
      {status === "connected" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {c.label}
    </span>
  );
}
