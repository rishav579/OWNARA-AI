"use client";

import { useState } from "react";
import { useRouter } from "@/lib/app/router";
import { CURRENT_USER } from "@/lib/app/data";
import { PageHeader, Avatar } from "@/components/app/ui";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Key,
  Monitor,
  Bell,
  Shield,
  Check,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "security", label: "Security", icon: Key },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

export function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("profile");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [notifPrefs, setNotifPrefs] = useState({
    approval_pending: true,
    task_completed: true,
    task_failed: true,
    employee_paused: false,
    email_digest: true,
  });

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and workspace preferences" />

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar tabs */}
        <div className="lg:col-span-1">
          <nav className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1 lg:flex-col">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    tab === t.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {tab === "profile" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-100">Profile</h3>
                <div className="flex items-center gap-4">
                  <Avatar name={CURRENT_USER.name} color={CURRENT_USER.avatarColor} size="lg" />
                  <button className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700">
                    Change avatar
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Full name</label>
                    <input
                      defaultValue={CURRENT_USER.name}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
                    <input
                      defaultValue={CURRENT_USER.email}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Save changes</button>
                  <button className="rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-700">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {tab === "workspace" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-100">Workspace</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Workspace name</label>
                  <input
                    defaultValue={CURRENT_USER.workspace}
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Slug</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">app.bihari-ai.in/</span>
                    <input
                      defaultValue={CURRENT_USER.workspaceSlug}
                      className="h-10 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Data region</label>
                  <select className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                    <option>India Central (Mumbai)</option>
                    <option>India South (Hyderabad)</option>
                    <option>Singapore</option>
                  </select>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Save changes</button>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-100">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">Current password</label>
                    <input type="password" placeholder="••••••••••" className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">New password</label>
                      <input type="password" placeholder="••••••••••" className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">Confirm</label>
                      <input type="password" placeholder="••••••••••" className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                </div>
                <button className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Update password</button>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Active Sessions</h3>
                    <p className="text-xs text-zinc-500">Devices currently signed in</p>
                  </div>
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  {[
                    { device: "MacBook Pro · Chrome", location: "Mumbai, IN", ip: "203.0.113.42", current: true, last: "Active now" },
                    { device: "iPhone 15 · Safari", location: "Mumbai, IN", ip: "203.0.113.43", current: false, last: "2 hours ago" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{s.device}</span>
                          {s.current && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-400">Current</span>}
                        </div>
                        <div className="text-xs text-zinc-500">{s.location} · {s.ip} · {s.last}</div>
                      </div>
                      {!s.current && (
                        <button className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-100">Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "light", label: "Light", icon: Sun },
                  { id: "system", label: "System", icon: Laptop },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as typeof theme)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                        theme === t.id ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", theme === t.id ? "text-emerald-400" : "text-zinc-400")} />
                      <span className={cn("text-sm font-medium", theme === t.id ? "text-zinc-100" : "text-zinc-400")}>{t.label}</span>
                      {theme === t.id && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-100">Notification Preferences</h3>
              <div className="space-y-3">
                {[
                  { key: "approval_pending", label: "Approval pending", desc: "When an AI Employee needs your approval" },
                  { key: "task_completed", label: "Task completed", desc: "When a task finishes successfully" },
                  { key: "task_failed", label: "Task failed", desc: "When a task fails" },
                  { key: "employee_paused", label: "Employee paused", desc: "When you pause an employee" },
                  { key: "email_digest", label: "Weekly email digest", desc: "Summary of activity every Monday" },
                ].map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{pref.label}</div>
                      <div className="text-xs text-zinc-500">{pref.desc}</div>
                    </div>
                    <button
                      onClick={() => setNotifPrefs({ ...notifPrefs, [pref.key]: !notifPrefs[pref.key as keyof typeof notifPrefs] })}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        notifPrefs[pref.key as keyof typeof notifPrefs] ? "bg-emerald-500" : "bg-zinc-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                          notifPrefs[pref.key as keyof typeof notifPrefs] ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
