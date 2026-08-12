"use client";

import { useRouter } from "@/lib/app/router";
import {
  ShieldCheck,
  Bot,
  ScrollText,
  Lock,
  Eye,
  CheckCircle2,
  ArrowRight,
  Workflow,
  IndianRupee,
  Briefcase,
  Users,
  Clock,
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
            <a href="#how-it-works" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">How it works</a>
            <a href="#employees" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">AI Employees</a>
            <a href="#trust" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">Trust</a>
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
            The AI Employee Platform
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
            Hire AI Employees
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              you can trust
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            BIHARI AI is the platform for hiring AI Employees that do real business work.
            Your first employee — a Finance Employee — chases overdue invoices,
            drafts collection reminders, and recovers payments. All under your approval.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate("login?signup=1")}
              className="group flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-all hover:bg-emerald-400"
            >
              Hire your Finance Employee
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate("login")}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-700"
            >
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
      </section>

      {/* Available Today + Coming Soon */}
      <section id="employees" className="border-t border-zinc-900 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              One platform. Many employees.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Start with Finance. Expand as we ship more AI Employees.
            </p>
          </div>

          {/* Available Now */}
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Available Today</span>
          </div>
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <IndianRupee className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-zinc-100">Finance Employee</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Chases overdue invoices, drafts collection reminders, manages accounts receivable — all under your approval.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-[0.65rem] font-medium text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Production ready
              </div>
            </div>
          </div>

          {/* Coming Soon */}
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Coming Soon</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Briefcase, title: "Sales Employee", desc: "Researches prospects, drafts outreach, follows up on leads." },
              { icon: Users, title: "HR Employee", desc: "Onboards new hires, manages leave requests, answers policy questions." },
              { icon: Bot, title: "Operations Employee", desc: "Monitors workflows, flags bottlenecks, automates routine operations." },
            ].map((emp) => (
              <div key={emp.title} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 opacity-70">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500">
                  <emp.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-zinc-300">{emp.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{emp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-zinc-900 py-20">
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
              Every action your Finance Employee takes follows the same loop. You delegate a responsibility,
              the employee continuously observes and reasons, critical actions wait for your approval, and
              everything is recorded in an immutable audit trail.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {[
                { step: "01", label: "Delegate", desc: "Entrust a responsibility to your Finance Employee" },
                { step: "02", label: "Observe", desc: "Employee continuously observes and reasons" },
                { step: "03", label: "Approve", desc: "You approve, reject, or modify critical actions" },
                { step: "04", label: "Audit", desc: "Every action is hash-chained and verifiable" },
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

      {/* Features */}
      <section className="border-t border-zinc-900 py-20">
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
              { icon: ShieldCheck, title: "Human Approval Gate", desc: "Critical actions — like sending a customer email — never execute without your approval. Approve, reject, or modify. You decide." },
              { icon: ScrollText, title: "Immutable Audit Trail", desc: "Every action, decision, and intervention is hash-chained and tamper-evident. Trust is verifiable, not assumed." },
              { icon: Eye, title: "Explainability", desc: "See why your employee took each action, grounded in evidence, policies, and customer history." },
              { icon: Lock, title: "Tool Restrictions", desc: "Strict whitelist. Your employee can only use the tools you grant. No shell, no code execution." },
              { icon: Workflow, title: "Always in Control", desc: "Pause, resume, or stop your employee instantly. Retire when done. The human is always in charge." },
              { icon: Bot, title: "Built for Trust", desc: "Every employee has a job description, operating boundaries, and a trust score that evolves with performance." },
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

      {/* CTA */}
      <section className="border-t border-zinc-900 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50">
            Hire your Finance Employee today
          </h2>
          <p className="mt-3 text-zinc-400">
            Sign up, upload your invoices, and watch your AI Employee start
            recovering overdue payments — all under your approval.
          </p>
          <button
            onClick={() => navigate("login?signup=1")}
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
            BIHARI AI — The AI Employee Platform
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
