"use client";

import { useEffect } from "react";
import { AppProviders, useRouter, useAuth } from "@/lib/app/router";
import { QueryProvider } from "@/components/app/query-provider";
import { AppShell } from "@/components/app/shell";
import { LandingPage } from "@/components/app/pages/landing";
import { AuthPage } from "@/components/app/pages/auth";
import { OnboardingPage } from "@/components/app/pages/onboarding";
import { DashboardPage } from "@/components/app/pages/dashboard";
import { EmployeesPage } from "@/components/app/pages/employees";
import { EmployeeDetailPage } from "@/components/app/pages/employee-detail";
import { TasksPage } from "@/components/app/pages/tasks";
import { DecisionCenterPage } from "@/components/app/pages/decision-center";
import { CommunicationPage } from "@/components/app/pages/communication";
import { TrustCenterPage } from "@/components/app/pages/trust-center";
import { AuditPage } from "@/components/app/pages/audit";
import { SettingsPage } from "@/components/app/pages/settings";
import { BillingPage } from "@/components/app/pages/billing";
import { FinancePage } from "@/components/app/pages/finance";
import { DelegateWorkPage } from "@/components/app/pages/delegate-work";
import { LoadingScreen } from "@/components/app/loading-states";

function AppRouter() {
  const { route, navigate } = useRouter();
  const { user, loading } = useAuth();
  const path = route.segments[0] ?? "";

  // Handle redirects in an effect (not during render)
  useEffect(() => {
    if (loading) return;
    // If on login page but already authenticated, go to dashboard
    if (path === "login" && user) {
      navigate("dashboard");
    }
    // If on a protected page but not authenticated, go to login
    if (path !== "" && path !== "login" && path !== "onboarding" && !user) {
      navigate("login");
    }
  }, [loading, path, user, navigate]);

  // Show loading screen while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  // Public pages (no auth required)
  if (path === "" || path === undefined) {
    return <LandingPage />;
  }
  if (path === "login") {
    if (user) return <LoadingScreen />;
    return <AuthPage />;
  }

  // Onboarding page — auth required, but rendered outside AppShell (full-screen wizard)
  if (path === "onboarding") {
    if (!user) return <LoadingScreen />;
    return <OnboardingPage />;
  }

  // Protected pages — require auth
  if (!user) {
    return <LoadingScreen />;
  }

  let page: React.ReactNode;
  switch (path) {
    case "dashboard":
      page = <DashboardPage />;
      break;
    case "delegate":
      page = <DelegateWorkPage />;
      break;
    case "employees":
      if (route.segments[1]) {
        page = <EmployeeDetailPage employeeId={route.segments[1]} />;
      } else {
        page = <EmployeesPage />;
      }
      break;
    case "tasks":
      page = <TasksPage />;
      break;
    case "approvals":
      page = <DecisionCenterPage />;
      break;
    case "communication":
      page = <CommunicationPage />;
      break;
    case "trust-center":
      page = <TrustCenterPage />;
      break;
    case "audit":
      page = <AuditPage />;
      break;
    case "finance":
      page = <FinancePage />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    case "billing":
      page = <BillingPage />;
      break;
    default:
      page = <DashboardPage />;
  }

  return <AppShell>{page}</AppShell>;
}

export default function Home() {
  return (
    <QueryProvider>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </QueryProvider>
  );
}
