import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { success, handleApiError } from "@/lib/api-response";
import { verifyAuditChain } from "@/lib/runtime/audit";

/**
 * GET /api/audit/verify
 * POST /api/audit/verify
 *
 * Verifies the cryptographic SHA-256 hash-chain integrity of the workspace's audit ledger.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const result = await verifyAuditChain(workspaceId);
    return success({
      ...result,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
