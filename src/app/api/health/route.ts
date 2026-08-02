import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health check endpoint for production monitoring.
 * Returns 200 if the application and database are healthy.
 * Returns 503 if any critical dependency is down.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    app: "ok",
  };

  // Check database connectivity
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
