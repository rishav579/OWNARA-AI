"use client";

import { useState, useRef } from "react";
import { useRouter, useAuth } from "@/lib/app/router";
import { api, setAccessToken, setCurrentUser } from "@/lib/app/api-client";
import {
  Building2,
  Bot,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Sparkles,
  IndianRupee,
  Loader2,
  AlertCircle,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MVP-001 — Onboarding Wizard
 *
 * 4-step wizard that gives a brand-new customer their "first value experience":
 *
 *   Step 1: Company details (name, industry, country, currency)
 *   Step 2: Choose AI Employee (Finance Employee enabled, others "coming soon")
 *   Step 3: Upload invoices (CSV paste or demo data)
 *   Step 4: Review + Finish
 *
 * On finish, calls POST /api/onboarding/setup which:
 *   - Hires a Finance Employee (Kavya)
 *   - Imports the customers + invoices
 *   - Auto-generates the first task: "Process overdue invoices"
 *
 * The customer is then redirected to the dashboard where they can watch
 * Kavya start working immediately.
 */

type Step = 1 | 2 | 3 | 4;

interface ParsedInvoice {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
}

const INDUSTRIES = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "trading", label: "Trading / Wholesale" },
  { value: "services", label: "Services" },
  { value: "technology", label: "Technology" },
  { value: "retail", label: "Retail" },
  { value: "pharma", label: "Pharmaceuticals" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other" },
];

const COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SG", label: "Singapore" },
  { value: "AU", label: "Australia" },
];

const CURRENCIES = [
  { value: "INR", label: "₹ INR (Indian Rupee)" },
  { value: "USD", label: "$ USD (US Dollar)" },
  { value: "EUR", label: "€ EUR (Euro)" },
  { value: "GBP", label: "£ GBP (British Pound)" },
  { value: "AED", label: "AED (UAE Dirham)" },
];

const EMPLOYEE_TEMPLATES = [
  {
    id: "finance",
    name: "Finance Employee",
    role: "finance_employee",
    description: "Processes overdue invoices, generates collection reminders, and manages accounts receivable — all under human approval.",
    enabled: true,
    badge: "Available now",
    capabilities: ["Invoice Analysis", "Collections", "Credit Risk", "Reminder Strategy"],
  },
];

const SAMPLE_CSV = `customer_name,customer_email,invoice_number,issue_date,due_date,subtotal,tax
Sundar Electronics,accounts@sundar-electronics.in,INV-2025-001,2025-07-25,2025-08-24,150000,27000
Nair Textiles Pvt Ltd,finance@nair-textiles.in,INV-2025-002,2025-06-15,2025-07-30,85000,15300
BlueDart Logistics,ap@bluedart-logistics.in,INV-2025-003,2025-05-15,2025-06-14,120000,21600
FastFreight India,billing@fastfreight.in,INV-2025-004,2025-04-15,2025-04-30,45000,8100
Acme Pharma Ltd,accounts@acme-pharma.in,INV-2024-098,2025-04-15,2025-06-14,220000,39600`;

export function OnboardingPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1 state
  const [industry, setIndustry] = useState("trading");
  const [country, setCountry] = useState("IN");
  const [currency, setCurrency] = useState("INR");

  // Step 2 state
  const [selectedEmployee, setSelectedEmployee] = useState("finance");

  // Step 3 state
  const [csvText, setCsvText] = useState("");
  const [useDemoData, setUseDemoData] = useState(false);
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[]>([]);
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── CSV parsing ─────────────────────────────────────────────────────────
  function parseCsv(text: string): ParsedInvoice[] {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row.");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const required = ["customer_name", "customer_email", "invoice_number", "issue_date", "due_date", "subtotal", "tax"];
    for (const req of required) {
      if (!headers.includes(req)) {
        throw new Error(`Missing required column: ${req}. Expected columns: ${required.join(", ")}`);
      }
    }

    const invoices: ParsedInvoice[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < headers.length) {
        throw new Error(`Row ${i + 1} has ${cols.length} columns, expected ${headers.length}.`);
      }

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cols[idx]?.trim() || ""; });

      // Convert amounts from rupees to paise (1 INR = 100 paise)
      const subtotal = Math.round(parseFloat(row.subtotal) * 100);
      const tax = Math.round(parseFloat(row.tax) * 100);

      if (isNaN(subtotal) || isNaN(tax)) {
        throw new Error(`Row ${i + 1}: subtotal and tax must be numbers.`);
      }

      invoices.push({
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        invoiceNumber: row.invoice_number,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        subtotal,
        tax,
      });
    }

    return invoices;
  }

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function handleParseCsv() {
    setParseError("");
    try {
      const invoices = parseCsv(csvText);
      setParsedInvoices(invoices);
    } catch (err: any) {
      setParsedInvoices([]);
      setParseError(err.message);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      // Auto-parse on upload
      try {
        const invoices = parseCsv(text);
        setParsedInvoices(invoices);
        setParseError("");
      } catch (err: any) {
        setParsedInvoices([]);
        setParseError(err.message);
      }
    };
    reader.readAsText(file);
  }

  function loadSampleCsv() {
    setCsvText(SAMPLE_CSV);
    try {
      const invoices = parseCsv(SAMPLE_CSV);
      setParsedInvoices(invoices);
      setParseError("");
    } catch (err: any) {
      setParseError(err.message);
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────
  async function handleFinish() {
    setSubmitting(true);
    setError("");
    try {
      const result = await api.onboarding.setup({
        industry,
        country,
        currency,
        invoices: useDemoData ? undefined : parsedInvoices,
        useDemoData,
      });

      // Invalidate the dashboard query so it refreshes with the new data
      // (React Query will refetch on navigation)

      // Navigate to the dashboard — the customer should see Kavya working
      navigate("dashboard");
    } catch (err: any) {
      setError(err.message || "Onboarding failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Demo mode (instant) ─────────────────────────────────────────────────
  async function handleDemoMode() {
    setSubmitting(true);
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
      // Reload to pick up the new auth state
      window.location.hash = "#/dashboard";
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Demo mode failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  const steps = [
    { num: 1, label: "Company", icon: Building2 },
    { num: 2, label: "AI Employee", icon: Bot },
    { num: 3, label: "Invoices", icon: Upload },
    { num: 4, label: "Review", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <button onClick={() => navigate("")} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white">
              B
            </div>
            <span className="text-sm font-bold tracking-tight">BIHARI AI</span>
          </button>
          <div className="text-xs text-zinc-500">
            Welcome, <span className="text-zinc-300">{user?.name}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Demo mode banner */}
        {step === 1 && (
          <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Want to see it in action first?</div>
                  <div className="text-xs text-zinc-400">Load a demo company with sample data — ready in 10 seconds.</div>
                </div>
              </div>
              <button
                onClick={handleDemoMode}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {submitting ? "Loading demo…" : "Load Demo Company"}
              </button>
            </div>
          </div>
        )}

        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isComplete = step > s.num;
            return (
              <div key={s.num} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                      isActive && "border-emerald-500 bg-emerald-500/10 text-emerald-400",
                      isComplete && "border-emerald-500 bg-emerald-500 text-emerald-950",
                      !isActive && !isComplete && "border-zinc-700 bg-zinc-900 text-zinc-500"
                    )}
                  >
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn(
                    "text-[0.65rem] font-medium",
                    isActive ? "text-zinc-200" : "text-zinc-500"
                  )}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    step > s.num ? "bg-emerald-500" : "bg-zinc-800"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
          {/* Step 1: Company */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">Tell us about your company</h2>
              <p className="mt-1 text-sm text-zinc-400">This helps us customize your AI Employee's behavior.</p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">Country</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Choose AI Employee */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">Hire your first AI Employee</h2>
              <p className="mt-1 text-sm text-zinc-400">Choose a role to get started. More roles are coming soon.</p>

              <div className="mt-6 space-y-3">
                {EMPLOYEE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => t.enabled && setSelectedEmployee(t.id)}
                    disabled={!t.enabled}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      selectedEmployee === t.id
                        ? "border-emerald-500 bg-emerald-500/5"
                        : t.enabled
                        ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                        : "border-zinc-800/50 bg-zinc-900/30 opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      t.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    )}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{t.name}</h3>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[0.6rem] font-medium",
                          t.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                        )}>
                          {t.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.capabilities.map((cap) => (
                          <span key={cap} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[0.6rem] text-zinc-400">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedEmployee === t.id && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Upload Invoices */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">Upload your invoices</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your AI Employee will analyze these and start working immediately.
              </p>

              {/* Demo data option */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    setUseDemoData(!useDemoData);
                    if (!useDemoData) {
                      setCsvText("");
                      setParsedInvoices([]);
                      setParseError("");
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                    useDemoData
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-100">Use sample data</h3>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Load 5 sample customers + 8 invoices (various aging) — perfect for a test run.
                    </p>
                  </div>
                  {useDemoData && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
                </button>
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-600">or upload your own</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* CSV upload */}
              <div className={cn("transition-opacity", useDemoData && "opacity-40 pointer-events-none")}>
                {/* File upload zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center transition-colors hover:border-emerald-500/50"
                >
                  <FileSpreadsheet className="h-8 w-8 text-zinc-500" />
                  <p className="mt-2 text-sm font-medium text-zinc-300">Click to upload CSV</p>
                  <p className="text-xs text-zinc-500">or drag and drop</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Sample CSV loader */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={loadSampleCsv}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Load sample CSV format →
                  </button>
                  {csvText && (
                    <button
                      onClick={() => {
                        setCsvText("");
                        setParsedInvoices([]);
                        setParseError("");
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* CSV text area */}
                {csvText && (
                  <div className="mt-3">
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      onBlur={handleParseCsv}
                      rows={6}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500"
                      placeholder="customer_name,customer_email,invoice_number,issue_date,due_date,subtotal,tax"
                    />
                    <button
                      onClick={handleParseCsv}
                      className="mt-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700"
                    >
                      Parse CSV
                    </button>
                  </div>
                )}

                {/* Parse error */}
                {parseError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}

                {/* Parsed preview */}
                {parsedInvoices.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">
                        {parsedInvoices.length} invoices ready to import
                      </span>
                      <span className="text-xs text-zinc-500">
                        {parsedInvoices.filter((i) => new Date(i.dueDate) < new Date()).length} overdue
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-zinc-900">
                          <tr className="text-left text-zinc-500">
                            <th className="px-3 py-2 font-medium">Invoice</th>
                            <th className="px-3 py-2 font-medium">Customer</th>
                            <th className="px-3 py-2 font-medium">Due</th>
                            <th className="px-3 py-2 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {parsedInvoices.map((inv, idx) => {
                            const isOverdue = new Date(inv.dueDate) < new Date();
                            const total = (inv.subtotal + inv.tax) / 100;
                            return (
                              <tr key={idx} className="text-zinc-300">
                                <td className="px-3 py-2 font-mono">{inv.invoiceNumber}</td>
                                <td className="px-3 py-2 truncate">{inv.customerName}</td>
                                <td className="px-3 py-2">
                                  <span className={isOverdue ? "text-amber-400" : "text-zinc-400"}>
                                    {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  ₹{total.toLocaleString("en-IN")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!useDemoData && parsedInvoices.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">Review and finish</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your AI Employee will start working the moment you click Finish.
              </p>

              <div className="mt-6 space-y-4">
                {/* Company summary */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <Building2 className="h-3.5 w-3.5" /> Company
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">Industry</div>
                      <div className="text-zinc-200">{INDUSTRIES.find((i) => i.value === industry)?.label}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Country</div>
                      <div className="text-zinc-200">{COUNTRIES.find((c) => c.value === country)?.label}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Currency</div>
                      <div className="text-zinc-200">{currency}</div>
                    </div>
                  </div>
                </div>

                {/* Employee summary */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <Bot className="h-3.5 w-3.5" /> AI Employee
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-100">Kavya — Finance Employee</div>
                      <div className="text-xs text-zinc-500">
                        Will process overdue invoices and generate collection reminders under your approval.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoices summary */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <Upload className="h-3.5 w-3.5" /> Invoices
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">Source</div>
                      <div className="text-zinc-200">{useDemoData ? "Sample data" : "CSV upload"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Invoices</div>
                      <div className="text-zinc-200">
                        {useDemoData ? "8" : parsedInvoices.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Overdue</div>
                      <div className="text-amber-400">
                        {useDemoData
                          ? "6"
                          : parsedInvoices.filter((i) => new Date(i.dueDate) < new Date()).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* What happens next */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" /> What happens next
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      Kavya (Finance Employee) is hired and ready to work.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      Your invoices are imported and analyzed for overdue status.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      Kavya automatically starts processing overdue invoices.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      You'll get approval requests in the Decision Center before any email is sent.
                    </li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Finish — Start working
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
