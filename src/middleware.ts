import { NextRequest, NextResponse } from "next/server";

/**
 * BIHARI AI — Security Middleware
 *
 * Adds production security headers and basic CORS handling.
 * Does NOT implement business logic — only HTTP-level safety.
 */

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ─── Security headers (all environments) ────────────────────────────────
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // ─── Production-only headers ─────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    // HSTS — only meaningful over HTTPS
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // ─── CORS ────────────────────────────────────────────────────────────────
  // In production, restrict to the configured origin.
  // In development, allow all origins (localhost).
  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : []; // empty = same-origin only in production

    if (process.env.NODE_ENV !== "production" || allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
