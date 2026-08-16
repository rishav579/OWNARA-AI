"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setAccessToken, setCurrentUser, setAuthFailureHandler, setRefreshToken } from "./api-client";

// ─── Router ──────────────────────────────────────────────────────────────────

export interface Route {
  path: string;
  segments: string[];
  params: Record<string, string>;
}

interface RouterContextValue {
  route: Route;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function parseHash(): Route {
  if (typeof window === "undefined") {
    return { path: "", segments: [], params: {} };
  }
  const hash = window.location.hash.replace(/^#\/?/, "");
  const segments = hash ? hash.split("/").filter(Boolean) : [];
  const path = segments.join("/");
  return { path, segments, params: {} };
}

// ─── Auth Context ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: { id: string; email: string; name: string; avatarColor: string; workspaceId?: string; workspaceName?: string; workspaceSlug?: string; role?: string } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name: string; workspaceName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener("hashchange", handler);
    if (!window.location.hash) {
      window.location.hash = "#/";
    }
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Set up auth failure handler to redirect to login
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      window.location.hash = "#/login";
    });
  }, []);

  // On mount, try to restore session from memory (token set at login)
  useEffect(() => {
    // Check if we have a token from a previous login this session
    const token = typeof window !== "undefined" ? window.sessionStorage.getItem("bihari_token") : null;
    if (token) {
      let cancelled = false;
      setAccessToken(token);
      api.auth.me().then((res) => {
        if (cancelled) return;
        const ws = res.workspaces[0];
        const fullUser = {
          ...res.user,
          workspaceId: ws?.id,
          workspaceName: ws?.name,
          workspaceSlug: ws?.slug,
          role: ws?.role,
        };
        setUser(fullUser);
        setCurrentUser(fullUser);
        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        window.sessionStorage.removeItem("bihari_token");
        setAccessToken(null);
        setLoading(false);
      });
      return () => { cancelled = true; };
    }
    // No token — use a microtask to avoid synchronous setState in effect
    Promise.resolve().then(() => setLoading(false));
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = `#/${path}`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken || null);
    window.sessionStorage.setItem("bihari_token", res.accessToken);
    const ws = res.workspaces[0];
    const fullUser = {
      ...res.user,
      workspaceId: ws?.id,
      workspaceName: ws?.name,
      workspaceSlug: ws?.slug,
      role: ws?.role,
    };
    setUser(fullUser);
    setCurrentUser(fullUser);
  }, []);

  const signup = useCallback(async (data: { email: string; password: string; name: string; workspaceName: string }) => {
    const res = await api.auth.signup(data);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken || null);
    window.sessionStorage.setItem("bihari_token", res.accessToken);
    const fullUser = {
      ...res.user,
      workspaceId: res.workspace.id,
      workspaceName: res.workspace.name,
      workspaceSlug: res.workspace.slug,
      role: "owner",
    };
    setUser(fullUser);
    setCurrentUser(fullUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setRefreshToken(null);
    setCurrentUser(null);
    setUser(null);
    window.sessionStorage.removeItem("bihari_token");
    window.location.hash = "#/login";
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
        {children}
      </AuthContext.Provider>
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within AppProviders");
  return ctx;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AppProviders");
  return ctx;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatINR(cents: number): string {
  const rupees = cents / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
