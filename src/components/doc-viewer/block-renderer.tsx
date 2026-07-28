import type { Block } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

// Inline renderer: supports **bold** and `code` and *italic*
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenize on ** ** , ` `, * *
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(regex);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      nodes.push(
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    } else {
      nodes.push(<span key={i}>{part}</span>);
    }
  });
  return nodes;
}

function CalloutBlock({
  variant,
  title,
  text,
}: {
  variant: "info" | "warning" | "success" | "principle";
  title?: string;
  text: string;
}) {
  const styles = {
    info: {
      wrap: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
      badge: "bg-emerald-500 text-emerald-50",
      label: "text-emerald-700 dark:text-emerald-300",
      icon: "i",
    },
    warning: {
      wrap: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
      badge: "bg-amber-500 text-amber-50",
      label: "text-amber-700 dark:text-amber-300",
      icon: "!",
    },
    success: {
      wrap: "border-l-teal-500 bg-teal-50 dark:bg-teal-950/30",
      badge: "bg-teal-500 text-teal-50",
      label: "text-teal-700 dark:text-teal-300",
      icon: "✓",
    },
    principle: {
      wrap: "border-l-zinc-700 bg-zinc-50 dark:bg-zinc-900/50",
      badge: "bg-zinc-700 text-zinc-50",
      label: "text-zinc-700 dark:text-zinc-300",
      icon: "§",
    },
  }[variant];

  return (
    <div
      className={cn(
        "my-5 rounded-r-lg border-l-4 p-4 sm:p-5",
        styles.wrap
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold",
            styles.badge
          )}
          aria-hidden
        >
          {styles.icon}
        </span>
        <div className="min-w-0 flex-1">
          {title && (
            <div
              className={cn(
                "mb-1 text-xs font-bold uppercase tracking-wider",
                styles.label
              )}
            >
              {title}
            </div>
          )}
          <p className="text-sm leading-relaxed text-foreground/90 sm:text-[0.95rem]">
            {renderInline(text)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p className="my-4 text-[0.95rem] leading-relaxed text-foreground/85 sm:text-base sm:leading-[1.75]">
          {renderInline(block.text)}
        </p>
      );
    case "h3":
      return (
        <h3 className="mt-8 mb-3 text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="my-4 space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-[0.95rem] leading-relaxed text-foreground/85 sm:text-base"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="min-w-0 flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="my-4 space-y-2.5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-[0.95rem] leading-relaxed text-foreground/85 sm:text-base"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-foreground/70">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="my-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/60">
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-border px-4 py-2.5 font-semibold text-foreground"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="odd:bg-background even:bg-muted/30 transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-border/60 px-4 py-2.5 align-top text-foreground/80",
                        ci === 0 && "font-medium text-foreground/90"
                      )}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <div className="my-5 overflow-x-auto rounded-lg border border-border bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              {block.lang}
            </span>
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>
          </div>
          <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
            <code className="font-mono text-zinc-200">{block.code}</code>
          </pre>
        </div>
      );
    case "callout":
      return (
        <CalloutBlock variant={block.variant} title={block.title} text={block.text} />
      );
    case "hr":
      return <hr className="my-8 border-border" />;
    default:
      return null;
  }
}
