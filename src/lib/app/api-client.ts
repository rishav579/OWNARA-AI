"use client";

// In-memory token storage (never localStorage for security)
let accessToken: string | null = null;
let currentUser: any = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setCurrentUser(user: any) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  constructor(code: string, message: string, status: number, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Navigation callback set by the app to redirect on auth failure
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`/api${path}`, { ...options, headers });

  // Try refresh on 401
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(`/api${path}`, { ...options, headers });
    }
  }

  // Safely read response text first to handle empty responses, HTML error pages, or non-JSON payloads
  const text = await res.text();
  let json: any = null;

  if (text && text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g., HTML from reverse proxy or plain text error)
      if (!res.ok) {
        if (res.status === 401 && onAuthFailure) {
          onAuthFailure();
        }
        const errorMsg =
          res.status === 502
            ? "Bad Gateway: Upstream service temporarily unavailable"
            : res.status === 503
            ? "Service Unavailable: The server is temporarily overloaded or restarting"
            : res.status === 504
            ? "Gateway Timeout: Upstream server timed out"
            : `Server returned HTTP ${res.status}: ${res.statusText || "Request failed"}`;
        throw new ApiError(`HTTP_${res.status}`, errorMsg, res.status, { rawText: text.substring(0, 500) });
      }
      throw new ApiError("INVALID_JSON", "Server returned a non-JSON response.", res.status, { rawText: text.substring(0, 500) });
    }
  } else {
    // Empty body (e.g., HTTP 204 No Content)
    if (res.ok) {
      return {} as T;
    }
    if (res.status === 401 && onAuthFailure) {
      onAuthFailure();
    }
    throw new ApiError(`HTTP_${res.status}`, `Server returned empty error response with status ${res.status}`, res.status);
  }

  if (!res.ok || (json && json.success === false)) {
    if (res.status === 401 && onAuthFailure) {
      onAuthFailure();
    }
    throw new ApiError(
      json?.error?.code || `HTTP_${res.status}`,
      json?.error?.message || `Request failed with status ${res.status}`,
      res.status,
      json?.error?.details
    );
  }

  return (json?.data ?? json) as T;
}

// Refresh token storage (stored in memory, set at login)
let refreshToken: string | null = null;

export function setRefreshToken(token: string | null) {
  refreshToken = token;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const json = await res.json();
      if (!json.success || !json.data.accessToken) return false;

      accessToken = json.data.accessToken;
      refreshToken = json.data.refreshToken;
      if (typeof window !== "undefined" && accessToken) {
        window.sessionStorage.setItem("ownara_token", accessToken);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ user: any; workspaces: any[]; accessToken: string; refreshToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    signup: (data: any) =>
      apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    me: () => apiFetch<{ user: any; workspaces: any[] }>("/auth/me"),
    logout: (refreshToken?: string) =>
      apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  },

  // Onboarding (MVP-001) — Customer Onboarding & First Value Experience
  onboarding: {
    // GET /api/onboarding/state — check if onboarding is complete
    state: () => apiFetch<any>("/onboarding/state"),
    // POST /api/onboarding/setup — hire finance employee + import invoices + generate first task
    setup: (data: {
      industry?: string;
      country?: string;
      currency?: string;
      invoices?: Array<{
        customerName: string;
        customerEmail: string;
        invoiceNumber: string;
        issueDate: string;
        dueDate: string;
        subtotal: number;
        tax: number;
      }>;
      useDemoData?: boolean;
    }) => apiFetch<any>("/onboarding/setup", { method: "POST", body: JSON.stringify(data) }),
    // POST /api/onboarding/demo — create a complete demo company instantly
    demo: (data?: { email?: string; password?: string; workspaceName?: string }) =>
      apiFetch<{ user: any; workspace: any; accessToken: string; refreshToken: string; expiresIn: number; isExistingDemo: boolean }>("/onboarding/demo", {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
  },

  // Dashboard
  dashboard: {
    get: () => apiFetch<any>("/dashboard"),
  },

  // Communications (COMM-001) — AI Employee Communication Engine
  // The universal messaging layer for every AI Employee.
  communications: {
    list: (params?: {
      status?: string; priority?: string; communicationType?: string;
      receiverType?: string; employeeId?: string; customerId?: string;
      taskId?: string; invoiceId?: string; search?: string; limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.priority) q.set("priority", params.priority);
      if (params?.communicationType) q.set("communicationType", params.communicationType);
      if (params?.receiverType) q.set("receiverType", params.receiverType);
      if (params?.employeeId) q.set("employeeId", params.employeeId);
      if (params?.customerId) q.set("customerId", params.customerId);
      if (params?.taskId) q.set("taskId", params.taskId);
      if (params?.invoiceId) q.set("invoiceId", params.invoiceId);
      if (params?.search) q.set("search", params.search);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return apiFetch<any[]>(`/communications${qs ? `?${qs}` : ""}`);
    },
    create: (data: any) => apiFetch<any>("/communications", { method: "POST", body: JSON.stringify(data) }),
    threads: (limit = 50) => apiFetch<any[]>(`/communications/threads?limit=${limit}`),
    stats: () => apiFetch<any>("/communications/stats"),
    search: (q: string, limit = 50) => apiFetch<any[]>(`/communications/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    action: (id: string, action: string, note?: string, reason?: string) =>
      apiFetch<any>(`/communications/${id}/action`, { method: "POST", body: JSON.stringify({ action, note, reason }) }),
    thread: (id: string) => apiFetch<any[]>(`/communications/${id}/thread`),
    reply: (id: string, data: any) => apiFetch<any>(`/communications/${id}/thread`, { method: "POST", body: JSON.stringify(data) }),
    employeeToEmployee: (data: any) => apiFetch<any>("/communications/employee-to-employee", { method: "POST", body: JSON.stringify(data) }),
  },

  // Employees
  employees: {
    list: (params?: { status?: string; role?: string; q?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.role) q.set("role", params.role);
      if (params?.q) q.set("q", params.q);
      const qs = q.toString();
      return apiFetch<any[]>(`/employees${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiFetch<any>(`/employees/${id}`),
    create: (data: any) => apiFetch<any>("/employees", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    pause: (id: string) => apiFetch<any>(`/employees/${id}/pause`, { method: "POST" }),
    resume: (id: string) => apiFetch<any>(`/employees/${id}/resume`, { method: "POST" }),
    retire: (id: string) => apiFetch<any>(`/employees/${id}`, { method: "DELETE" }),

    // Employee Profile Engine (EMP-001)
    // The profile is the employee's persistent career record: level, XP,
    // trust score, KPIs, skills, memory stats, capability stats.
    profile: (id: string) => apiFetch<any>(`/employees/${id}/profile`),
    performance: (id: string) => apiFetch<any>(`/employees/${id}/performance`),
    history: (id: string) => apiFetch<any[]>(`/employees/${id}/history`),

    // Autonomous Learning & Skill Evolution Engine (EMP-002)
    // Every completed task generates an OutcomeEvaluation that drives skill
    // reinforcement, pattern detection, strength/weakness detection,
    // business outcome history, career timeline, and achievement unlocks.
    careerTimeline: (id: string, limit = 50) =>
      apiFetch<any[]>(`/employees/${id}/career-timeline?limit=${limit}`),
    achievements: (id: string) => apiFetch<any[]>(`/employees/${id}/achievements`),
    patterns: (id: string, limit = 50) =>
      apiFetch<any[]>(`/employees/${id}/patterns?limit=${limit}`),
    strengths: (id: string) => apiFetch<any[]>(`/employees/${id}/strengths`),
    weaknesses: (id: string) => apiFetch<any[]>(`/employees/${id}/weaknesses`),
    outcomeHistory: (id: string, limit = 20) =>
      apiFetch<any[]>(`/employees/${id}/outcome-history?limit=${limit}`),
    businessImpact: (id: string) => apiFetch<any>(`/employees/${id}/business-impact`),
  },

  // Tasks
  tasks: {
    list: (params?: { status?: string; employeeId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.employeeId) q.set("employeeId", params.employeeId);
      const qs = q.toString();
      return apiFetch<any[]>(`/tasks${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiFetch<any>(`/tasks/${id}`),
    create: (data: any) => apiFetch<any>("/tasks", { method: "POST", body: JSON.stringify(data) }),
    timeline: (id: string) => apiFetch<any[]>(`/tasks/${id}/timeline`),
  },

  // Approvals
  approvals: {
    list: (status?: string) => {
      const qs = status ? `?status=${status}` : "";
      return apiFetch<any[]>(`/approvals${qs}`);
    },
    pending: () => apiFetch<any[]>("/approvals/pending"),
    get: (id: string) => apiFetch<any>(`/approvals/${id}`),
    approve: (id: string, payload?: { reason?: string; modifiedAction?: string }) =>
      apiFetch<any>(`/approvals/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      }),
    reject: (id: string, reason?: string) =>
      apiFetch<any>(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  },

  // Execution Contracts
  contracts: {
    get: (id: string) => apiFetch<any>(`/contracts/${id}`),
  },

  // Capabilities
  capabilities: {
    list: () => apiFetch<any[]>("/capabilities"),
    listForEmployee: (employeeId: string) => apiFetch<any[]>(`/employees/${employeeId}/capabilities`),
    grant: (employeeId: string, capabilityCode: string) =>
      apiFetch<any>(`/employees/${employeeId}/capabilities`, { method: "POST", body: JSON.stringify({ capabilityCode }) }),
    revoke: (employeeId: string, capabilityCode: string) =>
      apiFetch<any>(`/employees/${employeeId}/capabilities?code=${capabilityCode}`, { method: "DELETE" }),
  },

  // Knowledge
  knowledge: {
    list: (params?: { status?: string; employeeId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.employeeId) q.set("employeeId", params.employeeId);
      const qs = q.toString();
      return apiFetch<any[]>(`/knowledge${qs ? `?${qs}` : ""}`);
    },
    delete: (id: string) => apiFetch<any>(`/knowledge/${id}`, { method: "DELETE" }),
  },

  // Audit
  audit: {
    list: (params?: { entryType?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.entryType) q.set("entryType", params.entryType);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return apiFetch<any[]>(`/audit${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiFetch<any>(`/audit/${id}`),
    verify: () =>
      apiFetch<{ valid: boolean; brokenAt: number | null; totalEntries: number; verifiedAt: string }>("/audit/verify", {
        method: "POST",
      }),
  },

  // Notifications
  notifications: {
    list: () => apiFetch<any[]>("/notifications"),
    markRead: (id: string) => apiFetch<any>(`/notifications/${id}/read`, { method: "POST" }),
  },

  // Billing
  billing: {
    get: () => apiFetch<any>("/billing"),
  },

  // Phase 3: Governance
  governance: {
    policies: (params?: { category?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set("category", params.category);
      if (params?.status) q.set("status", params.status);
      const qs = q.toString();
      return apiFetch<any[]>(`/governance/policies${qs ? `?${qs}` : ""}`);
    },
    createPolicy: (data: any) => apiFetch<any>("/governance/policies", { method: "POST", body: JSON.stringify(data) }),
    updatePolicy: (id: string, data: any) => apiFetch<any>(`/governance/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    archivePolicy: (id: string) => apiFetch<any>(`/governance/policies/${id}`, { method: "DELETE" }),
    rules: () => apiFetch<any[]>("/governance/rules"),
    createRule: (data: any) => apiFetch<any>("/governance/rules", { method: "POST", body: JSON.stringify(data) }),
  },

  // Phase 3: Trust Scores
  trustScores: {
    list: (employeeId?: string) => {
      const qs = employeeId ? `?employeeId=${employeeId}` : "";
      return apiFetch<any[]>(`/trust-scores${qs}`);
    },
  },

  // Phase 3: Integrations
  integrations: {
    list: () => apiFetch<any[]>("/integrations"),
    connect: (id: string) => apiFetch<any>(`/integrations/${id}/connect`, { method: "POST" }),
    disconnect: (id: string) => apiFetch<any>(`/integrations/${id}/disconnect`, { method: "POST" }),
  },

  // Phase 3: Workspace Admin
  workspaceAdmin: {
    get: () => apiFetch<any>("/workspace-admin"),
  },

  // Phase 3: Business Activity
  businessActivity: {
    list: (limit?: number) => {
      const qs = limit ? `?limit=${limit}` : "";
      return apiFetch<any[]>(`/business-activity${qs}`);
    },
  },

  // Finance Domain
  finance: {
    invoices: (params?: { status?: string; customerId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.customerId) q.set("customerId", params.customerId);
      const qs = q.toString();
      return apiFetch<any[]>(`/finance/invoices${qs ? `?${qs}` : ""}`);
    },
    invoice: (id: string) => apiFetch<any>(`/finance/invoices/${id}`),
    createInvoice: (data: any) => apiFetch<any>("/finance/invoices", { method: "POST", body: JSON.stringify(data) }),
    customers: (status?: string) => {
      const qs = status ? `?status=${status}` : "";
      return apiFetch<any[]>(`/finance/customers${qs}`);
    },
    collectionCases: () => apiFetch<any[]>("/finance/collection-cases"),
    reminders: (status?: string) => {
      const qs = status ? `?status=${status}` : "";
      return apiFetch<any[]>(`/finance/reminders${qs}`);
    },
    metrics: () => apiFetch<any>("/finance/metrics"),
    import: (rows: any[], dataType: "invoices" | "customers" | "payments") =>
      apiFetch<{ imported: number; skipped: number; errors: number; errorRows: Array<{ row: number; error: string }> }>("/finance/import", {
        method: "POST",
        body: JSON.stringify({ rows, dataType }),
      }),
  },

  // Mandates — the fundamental primitive
  mandates: {
    list: (status?: string) => {
      const qs = status && status !== "all" ? `?status=${status}` : "";
      return apiFetch<any[]>(`/mandates${qs}`);
    },
    get: (id: string) => apiFetch<any>(`/mandates/${id}`),
    grant: (data: {
      title: string;
      declaration: string;
      successCriteria: string;
      authoritySpec: any;
      tenantId?: string;
      parentMandateId?: string;
    }) => apiFetch<any>("/mandates", { method: "POST", body: JSON.stringify(data) }),
    pause: (id: string, reason?: string) =>
      apiFetch<any>(`/mandates/${id}/pause`, { method: "POST", body: JSON.stringify({ reason }) }),
    resume: (id: string) =>
      apiFetch<any>(`/mandates/${id}/resume`, { method: "POST", body: JSON.stringify({}) }),
    revoke: (id: string, reason?: string) =>
      apiFetch<any>(`/mandates/${id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
    reassign: (id: string, newTenantId: string, reason?: string) =>
      apiFetch<any>(`/mandates/${id}/reassign`, { method: "POST", body: JSON.stringify({ newTenantId, reason }) }),
    evaluate: (id: string) =>
      apiFetch<any>(`/mandates/${id}?action=evaluate`, { method: "PATCH" }),
    timeline: (id: string) =>
      apiFetch<any[]>(`/mandates/${id}/timeline`),
  },
};
