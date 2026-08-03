import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

// JWT secret: hard-fail at runtime in production, allow placeholder during build.
// Next.js builds with NODE_ENV=production, so we check for the build phase
// via the presence of __NEXT_BUILD_PHASE or by using a lazy getter.
const _jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === "production"
  ? "build-time-placeholder" // Will be overridden by runtime env. If not, token verification fails safely.
  : "dev-secret-not-for-production");

function getJWTSecret(): string {
  if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === "build-time-placeholder")) {
    throw new Error("JWT_SECRET environment variable is required in production.");
  }
  return _jwtSecret;
}
const ACCESS_TOKEN_TTL = 60 * 15; // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceSlug?: string;
  role?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  workspaceId?: string;
  role?: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: Omit<JwtPayload, "type" | "iat" | "exp">): string {
  return jwt.sign({ ...payload, type: "access" }, getJWTSecret(), {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(payload: Omit<JwtPayload, "type" | "iat" | "exp">): string {
  return jwt.sign({ ...payload, type: "refresh" }, getJWTSecret(), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJWTSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return bcrypt.hashSync(token, 10);
}

export function compareToken(token: string, hash: string): boolean {
  return bcrypt.compareSync(token, hash);
}

// Get the authenticated user from the request (access token in Authorization header or cookie)
export async function getAuthUser(request?: Request): Promise<AuthUser | null> {
  let token: string | undefined;

  if (request) {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7);
    }
  }

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("accessToken")?.value;
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || payload.type !== "access") return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    include: {
      workspaceMembers: {
        where: { status: "active" },
        include: { workspace: true },
      },
    },
  });

  if (!user || user.status !== "active") return null;

  const activeMembership = payload.workspaceId
    ? user.workspaceMembers.find((m) => m.workspaceId === payload.workspaceId)
    : user.workspaceMembers[0];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarColor: user.avatarColor,
    workspaceId: activeMembership?.workspaceId,
    workspaceName: activeMembership?.workspace.name,
    workspaceSlug: activeMembership?.workspace.slug,
    role: activeMembership?.role,
  };
}

// Require auth — throws if not authenticated
export async function requireAuth(request?: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError("UNAUTHORIZED", "Authentication required", 401);
  }
  return user;
}

// Require a workspace context
export async function requireWorkspace(request?: Request): Promise<{ user: AuthUser; workspaceId: string }> {
  const user = await requireAuth(request);
  if (!user.workspaceId) {
    throw new AuthError("NO_WORKSPACE", "No active workspace", 400);
  }
  return { user, workspaceId: user.workspaceId };
}

export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL };
