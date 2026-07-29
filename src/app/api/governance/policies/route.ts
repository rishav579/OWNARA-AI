import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/auth";
import { success, error, handleApiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireWorkspace(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");

    const where: any = { workspaceId };
    if (category && category !== "all") where.category = category;
    if (status && status !== "all") where.status = status;

    const policies = await db.policy.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const data = policies.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category,
      description: p.description,
      rules: JSON.parse(p.rules),
      severity: p.severity,
      status: p.status,
      appliesTo: p.appliesTo,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return success(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, workspaceId } = await requireWorkspace(request);
    const body = await request.json();
    const { name, code, category, description, rules, severity, appliesTo } = body;

    // Count existing policies for code generation if not provided
    const count = await db.policy.count({ where: { workspaceId } });
    const policyCode = code || `POL-${String(count + 1).padStart(3, "0")}`;

    const policy = await db.policy.create({
      data: {
        workspaceId,
        name,
        code: policyCode,
        category: category || "compliance",
        description,
        rules: JSON.stringify(rules || []),
        severity: severity || "medium",
        appliesTo: appliesTo || "all",
        status: "active",
        createdBy: user.id,
      },
    });

    return success({
      id: policy.id,
      name: policy.name,
      code: policy.code,
      status: policy.status,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
