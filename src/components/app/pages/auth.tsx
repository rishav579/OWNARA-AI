"use client";

import { useState } from "react";
import { useRouter } from "@/lib/app/router";
import { ShieldCheck, Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export function AuthPage() {
  const { navigate } = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Left: form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:flex-1 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <button onClick={() => navigate("")} className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-lg shadow-emerald-500/20">
              B
            </div>
            <span className="text-sm font-bold tracking-tight">BIHARI AI</span>
          </button>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === "login"
              ? "Sign in to manage your AI Employees."
              : "Start hiring AI Employees in under 2 minutes."}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("dashboard");
            }}
            className="mt-8 space-y-4"
          >
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">Full name</label>
                <input
                  type="text"
                  defaultValue="Rohit Sharma"
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">Work email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  defaultValue="rohit@acmetrading.in"
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
                {mode === "login" && (
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  defaultValue="demo-password"
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              {mode === "login" ? "Sign in" : "Create account"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <button
            onClick={() => navigate("dashboard")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-zinc-500">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-emerald-400 hover:text-emerald-300"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>

      {/* Right: trust panel */}
      <div className="relative hidden overflow-hidden border-l border-zinc-900 bg-zinc-900/30 lg:flex lg:flex-1 lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" />
        <div className="relative max-w-md px-12">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Why BIHARI AI</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-50">
            Trust is not a feature.
            <br />
            It's the architecture.
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "Every critical action requires human approval",
              "Immutable, hash-chained audit trail",
              "Explainable decisions — see the reasoning",
              "Strict tool whitelists — no shell, no code execution",
              "Pause or stop any employee instantly",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-xs text-zinc-500">Active workspaces</div>
            <div className="mt-1 text-2xl font-bold text-zinc-50">1,200+</div>
            <div className="mt-1 text-xs text-zinc-500">businesses delegating work to AI Employees</div>
          </div>
        </div>
      </div>
    </div>
  );
}
