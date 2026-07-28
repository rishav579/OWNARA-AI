"use client";

import { RouterProvider, useRouter } from "@/lib/app/router";
import { AppShell } from "@/components/app/shell";
import { LandingPage } from "@/components/app/pages/landing";
import { AuthPage } from "@/components/app/pages/auth";
import { DashboardPage } from "@/components/app/pages/dashboard";
import { EmployeesPage } from "@/components/app/pages/employees";
import { EmployeeDetailPage } from "@/components/app/pages/employee-detail";
import { TasksPage } from "@/components/app/pages/tasks";
import { ApprovalsPage } from "@/components/app/pages/approvals";
import { KnowledgePage } from "@/components/app/pages/knowledge";
import { AuditPage } from "@/components/app/pages/audit";
import { SettingsPage } from "@/components/app/pages/settings";
import { BillingPage } from "@/components/app/pages/billing";

function AppRouter() {
  const { route } = useRouter();
  const path = route.segments[0] ?? "";

  // Public pages (no sidebar)
  if (path === "" || path === undefined) {
    return <LandingPage />;
  }
  if (path === "login") {
    return <AuthPage />;
  }

  // Protected pages (with sidebar shell)
  let page: React.ReactNode;
  switch (path) {
    case "dashboard":
      page = <DashboardPage />;
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
      page = <ApprovalsPage />;
      break;
    case "knowledge":
      page = <KnowledgePage />;
      break;
    case "audit":
      page = <AuditPage />;
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
    <RouterProvider>
      <AppRouter />
    </RouterProvider>
  );
}
