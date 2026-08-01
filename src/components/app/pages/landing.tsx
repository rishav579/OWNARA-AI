"use client";

import { useRouter } from "@/lib/app/router";
import {
  ShieldCheck,
  Bot,
  ScrollText,
  Zap,
  Lock,
  Eye,
  CheckCircle2,
  ArrowRight,
  Terminal,
  Workflow,
} from "lucide-react";

export function LandingPage() {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white">
              B
            </div>
            <span className="text-sm font-bold tracking-tight">BIHARI AI</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Features</a>
            <a href="#trust" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Trust</a>
            <a href="#how" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("login")}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("login?signup=1")}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#09090b)]" style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }} />

        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-400">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            India's Trusted AI Employee Company
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
            Hire AI Employees you can
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              actually trust
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Delegate real operational work to role-based AI Employees that are reliable,
            transparent, auditable, and always under your control. Every critical action
            requires your approval.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate("login")}
              className="group flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-all hover:bg-emerald-400"
            >
              Hire your first AI Employee
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate("dashboard")}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-700"
            >
              <Terminal className="h-4 w-4" />
              View live demo
            </button>
          </div>

          {/* Trust badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Human approval for every critical action</span>
            <span className="flex items-center gap-1.5"><ScrollText className="h-4 w-4 text-emerald-500" /> Full audit trail, hash-chained</span>
            <span className="flex items-center gap-1.5"><Eye className="h-4 w-4 text-emerald-500" /> Explainable decisions</span>
          </div>
        </div>

        {/* Product preview mockup */}
        <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-3 text-xs text-zinc-500">app.bihari-ai.in/dashboard</span>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4">
              {/* mini stat cards */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-[0.65rem] text-zinc-500">Active Employees</div>
                <div className="mt-1 text-lg font-bold text-zinc-50">3</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-[0.65rem] text-zinc-500">Pending Approvals</div>
                <div className="mt-1 text-lg font-bold text-amber-400">2</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="text-[0.65rem] text-zinc-500">Tasks This Month</div>
                <div className="mt-1 text-lg font-bold text-zinc-50">190</div>
              </div>
              {/* mini chart */}
              <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="mb-2 text-[0.65rem] text-zinc-500">Task Activity</div>
                <div className="flex h-12 items-end gap-1">
                  {[4, 6, 3, 7, 2, 1, 5, 8, 6, 4, 3, 2, 9, 5].map((v, i) => (
                    <div key={i} className="flex-1 rounded-t bg-emerald-500/60" style={{ height: `${(v / 9) * 100}%` }} />
                  ))}
                </div>
              </div>
              {/* approval card */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1 text-[0.65rem] font-semibold text-amber-400">
                  <Lock className="h-3 w-3" /> Approval needed
                </div>
                <div className="mt-1.5 text-xs text-zinc-300">Saanvi wants to send an email</div>
                <div className="mt-2 flex gap-1">
                  <span className="flex-1 rounded bg-emerald-500 py-1 text-center text-[0.6rem] font-bold text-emerald-950">Approve</span>
                  <span className="flex-1 rounded bg-zinc-700 py-1 text-center text-[0.6rem] font-bold text-zinc-300">Reject</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-900 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              Not a chatbot. An employee.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Generic AI tools produce plausible-but-untrustworthy output. BIHARI AI gives you
              an employee you can hold accountable.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Bot, title: "Role-based Employees", desc: "Hire from curated templates — Customer Support, Sales Dev, Research Analyst. Each has a job description and boundaries." },
              { icon: ShieldCheck, title: "Human Approval Gate", desc: "Critical actions never execute without your approval. Approve, reject, or modify — you decide." },
              { icon: ScrollText, title: "Immutable Audit Trail", desc: "Every action, decision, and intervention is hash-chained and tamper-evident. Trust is verifiable." },
              { icon: Eye, title: "Explainability", desc: "See why an employee took each action, grounded in its reasoning and the knowledge it used." },
              { icon: Lock, title: "Tool Restrictions", desc: "Strict whitelist. An employee can only use the tools you grant. No shell, no code execution." },
              { icon: Workflow, title: "Always in Control", desc: "Pause, resume, or stop any employee instantly. Retire when done. The human is always in charge." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-zinc-100">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section id="trust" className="border-t border-zinc-900 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-500/5 to-transparent p-8 sm:p-12">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">The Trust Loop</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-50">
              Delegate → Review → Approve → Audit
            </h2>
            <p className="mt-3 text-zinc-400">
              Every action an AI Employee takes follows the same loop. You delegate a task,
              the employee plans and executes in logged steps, critical actions wait for your
              approval, and everything is recorded in an immutable audit trail.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {[
                { step: "01", label: "Delegate", desc: "Assign a task to an employee" },
                { step: "02", label: "Review", desc: "Employee plans and executes in steps" },
                { step: "03", label: "Approve", desc: "You approve, reject, or modify" },
                { step: "04", label: "Audit", desc: "Every action is hash-chained" },
              ].map((s) => (
                <div key={s.step} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="font-mono text-xs text-emerald-400">{s.step}</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">{s.label}</div>
                  <div className="mt-0.5 text-[0.7rem] text-zinc-500">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-900 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Zap className="mx-auto h-8 w-8 text-emerald-400" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-50">
            Start delegating in minutes
          </h2>
          <p className="mt-3 text-zinc-400">
            Hire your first AI Employee from a template, upload your knowledge documents,
            and assign your first task. No code required.
          </p>
          <button
            onClick={() => navigate("login")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
              B
            </div>
            BIHARI AI — Every action is auditable. Every critical action is human-approved.
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
