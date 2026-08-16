/**
 * Delegate Work — Progress Timeline
 *
 * Shows the live execution stages of a delegated task:
 * Created → Planning → Needs Approval → Executing → Completed
 *
 * Polls the task endpoint every 2s to reflect worker progress.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/app/api-client";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, ShieldCheck, Brain, Zap } from "lucide-react";
import { formatRelativeTime } from "@/lib/app/router";

const STAGES = [
  { key: "created", label: "Task Created", icon: CheckCircle2 },
  { key: "planning", label: "Planning", icon: Brain },
  { key: "approval", label: "Needs Approval", icon: ShieldCheck },
  { key: "executing", label: "Executing", icon: Zap },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

function getActiveStageIndex(status: string): number {
  if (status === "queued") return 0;
  if (status === "planning") return 1;
  if (status === "waiting_approval") return 2;
  if (status === "executing") return 3;
  if (status === "completed") return 4;
  if (status === "failed" || status === "stopped") return 4;
  return 0;
}

export function ProgressTimeline({ taskId }: { taskId: string }) {
  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.tasks.get(taskId),
    refetchInterval: 2000,
  });

  if (!task) return null;

  const activeIndex = getActiveStageIndex(task.status);
  const isFailed = task.status === "failed";
  const isStopped = task.status === "stopped";
  const isComplete = task.status === "completed";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Execution Progress</h3>
        <span className={cn(
          "text-xs font-medium",
          isComplete ? "text-emerald-400" :
          isFailed || isStopped ? "text-red-400" :
          "text-amber-400"
        )}>
          {isComplete ? "Completed" : isFailed ? "Failed" : isStopped ? "Stopped" : "In Progress"}
        </span>
      </div>

      {/* Task title */}
      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="text-xs text-zinc-500">Task</div>
        <div className="text-sm font-medium text-zinc-200">{task.title}</div>
        {task.description && <div className="mt-1 text-xs text-zinc-500">{task.description}</div>}
      </div>

      {/* Stages */}
      <div className="space-y-1">
        {STAGES.map((stage, idx) => {
          const isDone = idx < activeIndex || isComplete;
          const isActive = idx === activeIndex && !isComplete;
          const isFuture = idx > activeIndex;
          const Icon = stage.icon;
          const approvalSkipped = stage.key === "approval" && isComplete &&
            !task.steps?.some((s: any) => s.stepType === "approval_gate");

          return (
            <div key={stage.key} className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
              isActive && "bg-emerald-500/5",
              isDone && "opacity-60",
              approvalSkipped && "opacity-30"
            )}>
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isDone && "bg-emerald-500/15 text-emerald-400",
                isActive && !isFailed && !isStopped && "bg-emerald-500 text-emerald-950",
                isActive && (isFailed || isStopped) && "bg-red-500/15 text-red-400",
                isFuture && "bg-zinc-800 text-zinc-500"
              )}>
                {isActive && !isFailed && !isStopped ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium", isDone || isActive ? "text-zinc-200" : "text-zinc-500")}>
                  {stage.label}
                </div>
                {isActive && task.startedAt && (
                  <div className="text-[0.65rem] text-zinc-500">Started {formatRelativeTime(task.startedAt)}</div>
                )}
              </div>
              {isDone && <span className="text-[0.65rem] text-emerald-400">✓</span>}
            </div>
          );
        })}
      </div>

      {/* Steps detail */}
      {task.steps && task.steps.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            Steps ({task.steps.length})
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {task.steps.map((step: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  step.status === "completed" ? "bg-emerald-500" :
                  step.status === "pending" ? "bg-amber-500" :
                  step.status === "failed" ? "bg-red-500" : "bg-zinc-600"
                )} />
                <span className="truncate text-zinc-400">
                  {step.stepType?.replace(/_/g, " ") || `Step ${step.stepNumber}`}
                </span>
                {step.reasoning && (
                  <span className="ml-auto truncate text-[0.65rem] text-zinc-600">
                    {step.reasoning.slice(0, 60)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failure reason */}
      {(isFailed || isStopped) && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="text-xs font-medium text-red-400">
            {isFailed ? "Task Failed" : "Task Stopped"}
          </div>
          {task.completedAt && (
            <div className="mt-0.5 text-xs text-zinc-500">Ended {formatRelativeTime(task.completedAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}
