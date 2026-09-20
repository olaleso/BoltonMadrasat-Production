import { d1 } from "@/db";
import {
  ApiError,
  type Actor,
  type Role,
} from "@/lib/backend";

export const permissionKeys = [
  "billing.view",
  "billing.manage",
  "payments.take",
  "payments.collect",
  "direct_debit.manage",
  "receipts.view",
] as const;

export type PermissionKey =
  (typeof permissionKeys)[number];

const defaults:
  Record<Role, PermissionKey[]> = {
    admin: [
      ...permissionKeys,
    ],

    finance: [
      "billing.view",
      "billing.manage",
      "payments.take",
      "payments.collect",
      "direct_debit.manage",
      "receipts.view",
    ],

    parent: [
      "billing.view",
      "payments.take",
      "direct_debit.manage",
      "receipts.view",
    ],

    teacher: [],

    safeguarding: [],
  };

export function defaultPermission(
  role: Role,
  permission: PermissionKey,
) {
  return defaults[
    role
  ].includes(
    permission,
  );
}

export function canAssignToRole(
  role: Role,
  permission: PermissionKey,
) {
  if (
    role === "admin"
  ) {
    return false;
  }

  if (
    role === "parent" &&
    (
      permission ===
        "billing.manage" ||
      permission ===
        "payments.collect"
    )
  ) {
    return false;
  }

  return true;
}

export async function hasPermission(
  who: Actor,
  permission: PermissionKey,
) {
  if (
    who.role ===
    "admin"
  ) {
    return true;
  }

  if (
    !canAssignToRole(
      who.role,
      permission,
    )
  ) {
    return false;
  }

  const override =
    await d1()
      .prepare(
        `select allowed
         from account_permissions
         where
           user_id = ?
           and permission = ?
         limit 1`,
      )
      .bind(
        who.id,
        permission,
      )
      .first<{
        allowed: number;
      }>();

  if (
    override
  ) {
    return (
      Number(
        override.allowed,
      ) === 1
    );
  }

  return defaultPermission(
    who.role,
    permission,
  );
}

export async function requirePermission(
  who: Actor,
  permission: PermissionKey,
  message =
    "You do not have permission for this action",
) {
  if (
    !(
      await hasPermission(
        who,
        permission,
      )
    )
  ) {
    throw new ApiError(
      403,
      message,
    );
  }
}

export async function effectivePermissions(
  who: Actor,
) {
  const result:
    PermissionKey[] = [];

  for (
    const permission
    of permissionKeys
  ) {
    if (
      await hasPermission(
        who,
        permission,
      )
    ) {
      result.push(
        permission,
      );
    }
  }

  return result;
}