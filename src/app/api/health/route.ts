import { NextResponse } from "next/server";

/**
 * Health check endpoint for Railway and production monitoring.
 * Returns HTTP 200 immediately without requiring external dependencies or auth.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "skipped"> = {
    app: "ok",
    database: "skipped",
  };

  // Safely check database connectivity without crashing healthcheck
  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  return NextResponse.json(
    {
      status: "healthy",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
