import {
  actor,
  audit,
  body,
  fail,
  json,
  required,
  ApiError,
} from "@/lib/backend";
import { d1 } from "@/db";

const staffRoles = [
  "admin",
  "teacher",
  "finance",
  "safeguarding",
  "parent",
] as const;

export async function GET(
  request: Request,
) {
  try {
    const user = await actor(
      request,
      [...staffRoles],
    );

    return json({
      ok: true,
      data: user,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const user = await actor(
      request,
      [...staffRoles],
    );
    const input = await body(request);
    const displayName = required(
      input.displayName,
      "Full name",
    );
    const email = required(
      input.email,
      "Email",
    ).toLowerCase();
    const db = d1();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError(
        400,
        "Enter a valid email address.",
      );
    }

    const duplicate = await db
      .prepare(
        `SELECT id
         FROM users
         WHERE lower(email) = lower(?)
           AND id <> ?
         LIMIT 1`,
      )
      .bind(email, user.id)
      .first<{ id: string }>();

    if (duplicate) {
      throw new ApiError(
        409,
        "Another account already uses this email address.",
      );
    }

    if (user.role === "parent") {
      const duplicateGuardian = await db
        .prepare(
          `SELECT id
           FROM guardians
           WHERE lower(email) = lower(?)
             AND coalesce(user_id, '') <> ?
           LIMIT 1`,
        )
        .bind(email, user.id)
        .first<{ id: string }>();

      if (duplicateGuardian) {
        throw new ApiError(
          409,
          "Another guardian already uses this email address.",
        );
      }
    }

    const updated = await db
      .prepare(
        `UPDATE users
         SET
           display_name = ?,
           email = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING
           id,
           email,
           display_name AS displayName,
           role`,
      )
      .bind(displayName, email, user.id)
      .first<{
        id: string;
        email: string;
        displayName: string;
        role: string;
      }>();

    if (!updated) {
      return json(
        { ok: false, error: "Profile was not found." },
        404,
      );
    }

    if (user.role === "parent") {
      await db
        .prepare(
          `UPDATE guardians
           SET
             full_name = ?,
             email = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
        )
        .bind(displayName, email, user.id)
        .run();
    }

    await audit(
      user,
      "update-own-profile",
      "users",
      user.id,
      { email },
    );

    return json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    return fail(error);
  }
}
