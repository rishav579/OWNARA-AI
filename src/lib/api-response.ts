import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return error(
      "VALIDATION_ERROR",
      "The request body failed validation.",
      400,
      err.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
    );
  }
  if (err && typeof err === "object" && "code" in err && "status" in err) {
    const e = err as { code: string; message: string; status: number };
    return error(e.code, e.message, e.status);
  }
  console.error("[API Error]", err);
  return error("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

// Parse JSON body safely
export async function parseBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw { code: "INVALID_JSON", message: "Invalid JSON body", status: 400 };
  }
}
