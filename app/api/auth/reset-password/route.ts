import { hash } from "bcryptjs";

import { d1 } from "@/db";
import {
  ApiError,
  body,
  fail,
  json,
  required,
  sha256,
} from "@/lib/backend";

type TokenRow = {
  id: string;
  user_id: string;
  purpose: string;
  expires_at: string;
  used_at: string | null;
};

export async function POST(request: Request) {
  try {
    const input = await body(request);
    const token = required(input.token, "Token");
    const password = required(input.password, "Password");
    const mode = String(input.mode ?? "reset");

    if (password.length < 8) {
      throw new ApiError(400, "Password must contain at least 8 characters.");
    }

    const allowedPurposes =
      mode === "setup"
        ? ["account_setup"]
        : ["password_reset"];

    const tokenHash = await sha256(token);

    const row = await d1()
      .prepare(
        `select id, user_id, purpose, expires_at, used_at
         from password_access_tokens
         where token_hash = ?
         limit 1`,
      )
      .bind(tokenHash)
      .first<TokenRow>();

    if (
      !row ||
      row.used_at ||
      !allowedPurposes.includes(row.purpose) ||
      Date.parse(row.expires_at) <= Date.now()
    ) {
      throw new ApiError(
        400,
        "This password link is invalid, expired, or has already been used.",
      );
    }

    const passwordHash = await hash(password, 12);

    await d1().batch([
      d1()
        .prepare(
          `update users
           set password_hash = ?
           where id = ?
             and status = 'active'`,
        )
        .bind(passwordHash, row.user_id),

      d1()
        .prepare(
          `update password_access_tokens
           set used_at = CURRENT_TIMESTAMP
           where id = ?`,
        )
        .bind(row.id),

      d1()
        .prepare(
          `delete from sessions
           where user_id = ?`,
        )
        .bind(row.user_id),
    ]);

    return json({
      ok: true,
      message:
        mode === "setup"
          ? "Your portal password has been set successfully."
          : "Your password has been reset successfully.",
    });
  } catch (error) {
    return fail(error);
  }
}
