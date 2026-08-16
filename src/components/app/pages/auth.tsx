"use client";

import { useState, useEffect } from "react";
import { useRouter, useAuth } from "@/lib/app/router";
import { api, setAccessToken, setCurrentUser } from "@/lib/app/api-client";
import { ShieldCheck, Mail, Lock, ArrowRight, CheckCircle2, Play, Loader2 } from "lucide-react";

export function AuthPage() {
  const { navigate } = useRouter();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("signup=1")) {
      return "signup";
    }
    return "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");

  // Deep-link: listen for hashchange to switch to signup mode
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.includes("signup=1")) {
        setMode("signup");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await login(email, password);
        navigate("dashboard");
      } else {
        await signup({ email, password, name, workspaceName });
        // New users go through the onboarding wizard
        navigate("onboarding");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Left: form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:flex-1 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <button onClick={() => navigate("")} className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-lg shadow-emerald-500/20">
              O
            </div>
            <span className="text-sm font-bold tracking-tight">OWNARA</span>
          </button>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === "login"
              ? "Sign in to manage your AI Employees."
              : "Start hiring AI Employees in under 2 minutes."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors focus:border-emerald-500"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? "Signing in…" : (mode === "login" ? "Sign in" : "Create account")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Demo mode — instant access to a pre-loaded demo company */}
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Play className="h-3.5 w-3.5 text-emerald-400" />
              <span>Want to explore without signing up?</span>
            </div>
            <button
              onClick={async () => {
                setDemoLoading(true);
                setError("");
                try {
                  const result = await api.onboarding.demo();
                  setAccessToken(result.accessToken);
                  window.sessionStorage.setItem("bihari_token", result.accessToken);
                  const fullUser = {
                    ...result.user,
                    workspaceId: result.workspace.id,
                    workspaceName: result.workspace.name,
                    workspaceSlug: result.workspace.slug,
                    role: "owner",
                  };
                  setCurrentUser(fullUser);
                  window.location.hash = "#/dashboard";
                  window.location.reload();
                } catch (err: any) {
                  setError(err.message || "Demo mode failed");
                } finally {
                  setDemoLoading(false);
                }
              }}
              disabled={demoLoading}
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {demoLoading ? "Loading demo…" : "Load Demo Company"}
            </button>
          </div>

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
            <span className="text-xs font-semibold uppercase tracking-wider">Why OWNARA</span>
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
            <div className="text-xs text-zinc-500">Enterprise-ready</div>
            <div className="mt-1 text-sm font-medium text-zinc-300">Hash-chained audit trail · Immutable execution contracts · Human approval gates</div>
          </div>
        </div>
      </div>
    </div>
  );
}
