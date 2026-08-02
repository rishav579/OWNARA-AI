"use client";

import { useAuth } from "@/lib/app/router";
import { PageHeader, Avatar } from "@/components/app/ui";
import { Shield } from "lucide-react";

/**
 * Settings page — honest and minimal.
 * Only shows what actually works: profile info (read-only for now),
 * workspace info (read-only), and security info.
 * No fake Save buttons, no fake sessions, no non-functional toggles.
 */
export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Settings" description="Your account and workspace" />

      <div className="max-w-2xl space-y-5">
        {/* Profile */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-100">Profile</h3>
          <div className="flex items-center gap-4">
            <Avatar name={user?.name || "U"} color={user?.avatarColor || "#10b981"} size="lg" />
            <div>
              <div className="text-sm font-medium text-zinc-100">{user?.name}</div>
              <div className="text-xs text-zinc-500">{user?.email}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Profile editing is not available in this version. Contact support to update your name or email.
          </p>
        </div>

        {/* Workspace */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-100">Workspace</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Name</span>
              <span className="text-zinc-200">{user?.workspaceName || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">URL</span>
              <span className="font-mono text-xs text-zinc-400">{user?.workspaceSlug || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Role</span>
              <span className="capitalize text-zinc-200">{user?.role || "owner"}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Security</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Authentication</span>
              <span className="text-zinc-200">Email & password</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Audit trail</span>
              <span className="text-emerald-400">Active (hash-chained)</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Approval gates</span>
              <span className="text-emerald-400">Enabled for all critical actions</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Password changes, SSO, and session management will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
