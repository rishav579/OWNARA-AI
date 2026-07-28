"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// ─── Router ──────────────────────────────────────────────────────────────────

export interface Route {
  path: string;       // e.g. "dashboard", "employees", "employees/e_018f9a50"
  segments: string[]; // e.g. ["employees", "e_018f9a50"]
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

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener("hashchange", handler);
    // Set default route to landing if no hash
    if (!window.location.hash) {
      window.location.hash = "#/";
    }
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = `#/${path}`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
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
