import { compare } from "bcryptjs";
import { d1 } from "@/db";

export type Role = "admin" | "teacher" | "finance" | "safeguarding" | "parent";

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  roles: Role[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const supportedRoles: Role[] = [
  "admin",
  "teacher",
  "finance",
  "safeguarding",
  "parent",
];

function normalizeRole(value: unknown): Role {
  const role = String(value ?? "").trim().toLowerCase();

  // Older staff accounts were stored with the generic `staff` role.
  // They are teaching staff and receive the same access as `teacher`.
  if (role === "staff") return "teacher";

  if (supportedRoles.includes(role as Role)) return role as Role;

  throw new ApiError(403, "This account has an unsupported portal role");
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });

export async function body(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiError(415, "Content-Type must be application/json");
  }

  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

export function required(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${name} is required`);
  }
  return value.trim();
}

export function optional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function integer(value: unknown, name: string, min = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new ApiError(400, `${name} must be an integer of at least ${min}`);
  }
  return n;
}

export function boolean(value: unknown) {
  return value === true || value === "true" || value === 1;
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return json({ ok: false, error: error.message }, error.status);
  }

  console.error(error);
  return json({ ok: false, error: "Unexpected server error" }, 500);
}

export function cookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";

  return (
    raw
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function actor(
  request: Request,
  allowed?: Role[],
): Promise<Actor> {
  const token = cookie(request, "madrasat_session");
  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();

  const user = await d1()
    .prepare(
      `select
         u.id,
         u.email,
         u.display_name as displayName,
         u.role as legacyRole,
         coalesce(
           group_concat(distinct ur.role),
           u.role
         ) as assignedRoles
       from sessions s
       join users u
         on u.id = s.user_id
       left join user_roles ur
         on ur.user_id = u.id
       where s.token_hash = ?
         and s.expires_at > ?
         and u.status = 'active'
       group by
         u.id,
         u.email,
         u.display_name,
         u.role
       limit 1`,
    )
    .bind(tokenHash, now)
    .first<{
      id: string;
      email: string;
      displayName: string;
      legacyRole: string;
      assignedRoles: string | null;
    }>();

  if (!user) {
    throw new ApiError(401, "Session expired");
  }

  const roles = Array.from(
    new Set(
      String(user.assignedRoles ?? user.legacyRole)
        .split(",")
        .map((value) => normalizeRole(value)),
    ),
  );

  if (!roles.length) {
    throw new ApiError(403, "This account has no portal role");
  }

  const preferredRaw = cookie(request, "madrasat_active_role");
  const preferredRole = preferredRaw
    ? (() => {
        try {
          return normalizeRole(preferredRaw);
        } catch {
          return null;
        }
      })()
    : null;

  const allowedRoles = allowed
    ? roles.filter((role) => allowed.includes(role))
    : roles;

  if (!allowedRoles.length) {
    throw new ApiError(403, "You do not have permission for this action");
  }

  let role: Role;

  if (preferredRole && allowedRoles.includes(preferredRole)) {
    role = preferredRole;
  } else {
    let legacyRole: Role | null = null;

    try {
      legacyRole = normalizeRole(user.legacyRole);
    } catch {
      legacyRole = null;
    }

    if (legacyRole && allowedRoles.includes(legacyRole)) {
      role = legacyRole;
    } else {
      const priority: Role[] = [
        "admin",
        "teacher",
        "finance",
        "safeguarding",
        "parent",
      ];

      role =
        priority.find((candidate) => allowedRoles.includes(candidate)) ??
        allowedRoles[0];
    }
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role,
    roles,
  };
}

export async function authenticate(email: string, password: string) {
  const user = await d1()
    .prepare(
      `select
         u.id,
         u.email,
         u.display_name as displayName,
         u.role as legacyRole,
         u.password_hash as passwordHash,
         coalesce(
           group_concat(distinct ur.role),
           u.role
         ) as assignedRoles
       from users u
       left join user_roles ur
         on ur.user_id = u.id
       where lower(u.email) = lower(?)
         and u.status = 'active'
       group by
         u.id,
         u.email,
         u.display_name,
         u.role,
         u.password_hash
       limit 1`,
    )
    .bind(email)
    .first<{
      id: string;
      email: string;
      displayName: string;
      legacyRole: string;
      passwordHash: string;
      assignedRoles: string | null;
    }>();

  if (!user || !(await compare(password, user.passwordHash))) {
    throw new ApiError(401, "Incorrect email or password");
  }

  const roles = Array.from(
    new Set(
      String(user.assignedRoles ?? user.legacyRole)
        .split(",")
        .map((value) => normalizeRole(value)),
    ),
  );

  let legacyRole: Role | null = null;

  try {
    legacyRole = normalizeRole(user.legacyRole);
  } catch {
    legacyRole = null;
  }

  const priority: Role[] = [
    "admin",
    "teacher",
    "finance",
    "safeguarding",
    "parent",
  ];

  const role =
    legacyRole && roles.includes(legacyRole)
      ? legacyRole
      : priority.find((candidate) => roles.includes(candidate)) ?? roles[0];

  if (!role) {
    throw new ApiError(403, "This account has no portal role");
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role,
    roles,
    passwordHash: user.passwordHash,
  };
}

export async function audit(
  who: Actor,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: unknown = {},
) {
  await d1()
    .prepare(
      `insert into audit_log
         (id, user_id, action, entity_type, entity_id, details)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      who.id,
      action,
      entityType,
      entityId ?? null,
      JSON.stringify(metadata ?? {}),
    )
    .run();
}


