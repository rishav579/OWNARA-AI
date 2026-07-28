"use client";

import { useMemo, useState, useEffect } from "react";
import { DEP_001, DOC_REGISTRY } from "@/lib/docs/content";
import type { DocMeta } from "@/lib/docs/types";
import { BlockRenderer } from "@/components/doc-viewer/block-renderer";
import { cn } from "@/lib/utils";
import {
  FileText,
  Layers,
  Database,
  Cable,
  Server,
  MonitorSmartphone,
  GitBranch,
  Rocket,
  Lock,
  ChevronRight,
  Search,
  Hash,
  ShieldCheck,
  CircleDot,
  CheckCircle2,
  ScrollText,
  Menu,
  X,
} from "lucide-react";

const CATEGORY_ICON: Record<DocMeta["category"], React.ElementType> = {
  Product: FileText,
  Architecture: Layers,
  Database: Database,
  API: Cable,
  Backend: Server,
  Frontend: MonitorSmartphone,
  Repository: GitBranch,
  Deployment: Rocket,
};

function StatusBadge({ status }: { status: DocMeta["status"] }) {
  if (status === "LOCKED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
        <Lock className="h-2.5 w-2.5" />
        Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-800">
      <CircleDot className="h-2.5 w-2.5" />
      {status}
    </span>
  );
}

export default function Home() {
  const activeDoc = DEP_001;
  const [activeSectionId, setActiveSectionId] = useState<string>(
    activeDoc.sections[0]?.id ?? ""
  );
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Scroll spy: highlight the section currently in view
  useEffect(() => {
    const ids = activeDoc.sections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: [0, 1] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [activeDoc]);

  const filteredRegistry = useMemo(() => {
    if (!query.trim()) return DOC_REGISTRY;
    const q = query.toLowerCase();
    return DOC_REGISTRY.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [query]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setMobileNavOpen(false);
  };

  const featuredSections = activeDoc.sections.filter(
    (s) => s.number !== ""
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ───────── Top Header ───────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-sm">
              <span className="text-sm tracking-tight">B</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight tracking-tight">
                BIHARI AI
              </div>
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Engineering Docs
              </div>
            </div>
          </div>

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          {/* Active doc pill */}
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeDoc.code}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {activeDoc.title}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={activeDoc.status} />
            <span className="hidden rounded-md border border-border px-2 py-1 font-mono text-[0.65rem] text-muted-foreground sm:inline-block">
              v{activeDoc.version}
            </span>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ───────── Body ───────── */}
      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        {/* Left: document registry */}
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-30 w-72 shrink-0 overflow-y-auto border-r border-border bg-background px-3 py-5 transition-transform lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:bg-transparent",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-4 px-2">
            <div className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5" />
              Document Registry
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter documents…"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          <nav className="space-y-1">
            {filteredRegistry.map((doc) => {
              const Icon = CATEGORY_ICON[doc.category];
              const isActive = doc.code === activeDoc.code;
              return (
                <a
                  key={doc.code}
                  href={isActive ? undefined : "#"}
                  aria-disabled={!isActive}
                  className={cn(
                    "group flex items-start gap-2.5 rounded-lg border px-2.5 py-2.5 transition-all",
                    isActive
                      ? "border-emerald-500/40 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono text-[0.7rem] font-semibold",
                          isActive
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-muted-foreground"
                        )}
                      >
                        {doc.code}
                      </span>
                      <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                    <div
                      className={cn(
                        "truncate text-xs font-medium",
                        isActive ? "text-foreground" : "text-foreground/80"
                      )}
                    >
                      {doc.title}
                    </div>
                  </div>
                  {isActive && (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="mt-6 rounded-lg border border-dashed border-border p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trust Architecture
            </div>
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
              Every document is LOCKED. Changes require a versioned revision,
              never in-place edits.
            </p>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 top-16 z-20 bg-black/30 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* Center: main reading area */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-3xl">
            {/* Document hero */}
            <div className="mb-8 border-b border-border pb-7">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-emerald-500 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {activeDoc.code}
                </span>
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
                  Version {activeDoc.version}
                </span>
                <StatusBadge status={activeDoc.status} />
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                  {activeDoc.category}
                </span>
              </div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {activeDoc.title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {activeDoc.subtitle}
              </p>

              {/* Meta cards */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    Scope
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {activeDoc.scope}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    Subordinate To
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeDoc.subordinateTo.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground/70"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <article>
              {activeDoc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 border-b border-border/60 py-7 first:pt-0 last:border-0"
                >
                  {section.number && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        §{section.number}
                      </span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {section.title}
                  </h2>
                  <div>
                    {section.blocks.map((block, i) => (
                      <BlockRenderer key={i} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </article>

            {/* Footer of document */}
            <div className="mt-10 rounded-xl border border-border bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-5 dark:from-emerald-950/20 dark:to-teal-950/10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    End of {activeDoc.code} — {activeDoc.title}, Version{" "}
                    {activeDoc.version}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    This document is the authoritative{" "}
                    {activeDoc.category.toLowerCase()} reference for V1. It is
                    implementation-ready and consistent with all upstream locked
                    documents. Any change requires a versioned revision (
                    {activeDoc.code}.1, etc.). It is subordinate to those
                    documents; where any conflict appears, the upstream document
                    prevails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right: on-this-page nav */}
        <aside className="hidden w-64 shrink-0 py-10 pr-6 xl:block">
          <div className="sticky top-24">
            <div className="mb-3 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              On this page
            </div>
            <nav className="space-y-0.5 border-l border-border">
              {featuredSections.map((s) => {
                const isActive = activeSectionId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={cn(
                      "-ml-px block w-full border-l-2 py-1 pl-3 text-left text-xs transition-colors",
                      isActive
                        ? "border-emerald-500 font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <span className="font-mono text-[0.65rem] text-muted-foreground/70">
                      {s.number}
                    </span>{" "}
                    {s.title}
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 rounded-lg border border-border p-3">
              <div className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                Document Stats
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sections</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {featuredSections.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {activeDoc.status}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {activeDoc.version}.0
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>

      {/* ───────── Sticky Footer ───────── */}
      <footer className="mt-auto border-t border-border bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                B
              </div>
              <div>
                <div className="text-xs font-bold tracking-tight">
                  BIHARI AI
                </div>
                <div className="text-[0.65rem] text-muted-foreground">
                  India&apos;s Trusted AI Employee Company
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Every action is auditable
              </span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3 text-amber-500" />
                Every critical action is human-approved
              </span>
              <span className="font-mono">
                {DOC_REGISTRY.length} locked documents · V1
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
