import { compare } from "bcryptjs";
import { sql } from "@/db";

export type Role = "admin" | "teacher" | "finance" | "safeguarding" | "parent";
export type Actor = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });
export async function body(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json"))
    throw new ApiError(415, "Content-Type must be application/json");
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}
export function required(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim())
    throw new ApiError(400, `${name} is required`);
  return value.trim();
}
export function optional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function integer(value: unknown, name: string, min = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min)
    throw new ApiError(400, `${name} must be an integer of at least ${min}`);
  return n;
}
export function boolean(value: unknown) {
  return value === true || value === "true" || value === 1;
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return json({ ok: false, error: error.message }, error.status);
  console.error(error);
  return json({ ok: false, error: "Unexpected server error" }, 500);
}
export function cookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  return (
    raw
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}
export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function actor(
  request: Request,
  allowed?: Role[],
): Promise<Actor> {
  const token = cookie(request, "madrasat_session");
  if (!token) throw new ApiError(401, "Authentication required");
  const tokenHash = await sha256(token);
  const rows = await sql<
    Actor[]
  >`select u.id, u.email, u.display_name as "displayName", u.role from sessions s join users u on u.id=s.user_id where s.token_hash=${tokenHash} and s.expires_at>now() and u.status='active' limit 1`;
  const user = rows[0];
  if (!user) throw new ApiError(401, "Session expired");
  if (allowed && !allowed.includes(user.role))
    throw new ApiError(403, "You do not have permission for this action");
  return user;
}
export async function authenticate(email: string, password: string) {
  const rows = await sql<
    {
      id: string;
      email: string;
      displayName: string;
      role: Role;
      passwordHash: string;
    }[]
  >`select id,email,display_name as "displayName",role,password_hash as "passwordHash" from users where lower(email)=lower(${email}) and status='active' limit 1`;
  const user = rows[0];
  if (!user || !(await compare(password, user.passwordHash)))
    throw new ApiError(401, "Incorrect email or password");
  return user;
}
export async function audit(
  who: Actor,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: unknown = {},
) {
  await sql`insert into audit_log(actor_user_id,action,entity_type,entity_id,metadata) values(${who.id},${action},${entityType},${entityId ?? null},${sql.json(metadata as never)})`;
}
