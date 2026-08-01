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

  const json = await res.json();

  if (!res.ok || !json.success) {
    if (res.status === 401 && onAuthFailure) {
      onAuthFailure();
    }
    throw new ApiError(
      json.error?.code || "UNKNOWN",
      json.error?.message || "Request failed",
      res.status,
      json.error?.details
    );
  }

  return json.data as T;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      // For demo: re-login isn't available, so we just fail.
      // In production, this would call /api/auth/refresh with the refresh token cookie.
      // For now, the app keeps the token in memory for the session.
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

  // Dashboard
  dashboard: {
    get: () => apiFetch<any>("/dashboard"),
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
    approve: (id: string, reason?: string) =>
      apiFetch<any>(`/approvals/${id}/approve`, { method: "POST", body: JSON.stringify({ reason }) }),
    reject: (id: string, reason?: string) =>
      apiFetch<any>(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  },

  // Execution Contracts
  contracts: {
    get: (id: string) => apiFetch<any>(`/contracts/${id}`),
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
  },
};
