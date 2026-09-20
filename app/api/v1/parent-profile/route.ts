import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  required,
  optional,
  ApiError,
} from "@/lib/backend";

async function guardianForUser(userId: string) {
  return d1()
    .prepare(
      `select
         id,
         user_id,
         full_name,
         email,
         phone,
         address,
         postcode,
         emergency_contact_number,
         relationship
       from guardians
       where user_id = ?
       limit 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
}

export async function GET(request: Request) {
  try {
    const who = await actor(request, ["parent"]);
    const guardian = await guardianForUser(who.id);

    if (!guardian) {
      throw new ApiError(
        404,
        "Your guardian contact record could not be found. Please contact the Madrasah administrator.",
      );
    }

    return json({
      ok: true,
      data: guardian,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const who = await actor(request, ["parent"]);
    const x = await body(request);
    const guardian = await guardianForUser(who.id);

    if (!guardian) {
      throw new ApiError(
        404,
        "Your guardian contact record could not be found. Please contact the Madrasah administrator.",
      );
    }

    const guardianId = String(guardian.id ?? "");
    const displayName = required(x.displayName, "Full name");
    const email = required(x.email, "Email").toLowerCase();
    const phone = required(x.phone, "Phone");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError(400, "Enter a valid email address.");
    }

    const duplicateUser = await d1()
      .prepare(
        `select id
         from users
         where lower(email) = lower(?)
           and id <> ?
         limit 1`,
      )
      .bind(email, who.id)
      .first();

    if (duplicateUser) {
      throw new ApiError(409, "Another portal account already uses this email address.");
    }

    const duplicateGuardian = await d1()
      .prepare(
        `select id
         from guardians
         where lower(email) = lower(?)
           and id <> ?
         limit 1`,
      )
      .bind(email, guardianId)
      .first();

    if (duplicateGuardian) {
      throw new ApiError(409, "Another guardian already uses this email address.");
    }

    const db = d1();
    await db.batch([
      db.prepare(
        `update guardians
         set
           full_name = ?,
           email = ?,
           phone = ?,
           address = ?,
           postcode = ?,
           emergency_contact_number = ?,
           updated_at = CURRENT_TIMESTAMP
         where id = ?`,
      ).bind(
        displayName,
        email,
        phone,
        optional(x.address),
        optional(x.postcode),
        optional(x.emergencyContactNumber),
        guardianId,
      ),
      db.prepare(
        `update users
         set
           display_name = ?,
           email = ?,
           updated_at = CURRENT_TIMESTAMP
         where id = ?`,
      ).bind(displayName, email, who.id),
    ]);

    await audit(
      who,
      "update-own-contact-details",
      "guardians",
      guardianId,
      { email },
    );

    const updated = await guardianForUser(who.id);

    return json({
      ok: true,
      data: {
        displayName,
        email,
        ...(updated ?? {}),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
