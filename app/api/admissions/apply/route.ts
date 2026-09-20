import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { sendTrackedEmail } from "@/lib/email-delivery";

function setting(
  rows: D1Result<Record<string, unknown>>,
  key: string,
  fallback: string,
) {
  const row =
    rows.results?.find(
      (item) =>
        item.key === key,
    );

  return String(
    row?.value ?? fallback,
  );
}

function text(
  value: unknown,
) {
  return String(
    value ?? "",
  ).trim();
}


function applicationAge(
  dateOfBirth: unknown,
) {
  const raw =
    text(
      dateOfBirth,
    );

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      raw,
    );

  if (
    !match
  ) {
    return "";
  }

  const year =
    Number(
      match[1],
    );

  const month =
    Number(
      match[2],
    );

  const day =
    Number(
      match[3],
    );

  const today =
    new Date();

  let age =
    today.getUTCFullYear() -
    year;

  const currentMonth =
    today.getUTCMonth() +
    1;

  const currentDay =
    today.getUTCDate();

  if (
    currentMonth <
      month ||
    (
      currentMonth ===
        month &&
      currentDay <
        day
    )
  ) {
    age -=
      1;
  }

  return age >= 0
    ? String(
        age,
      )
    : "";
}

function truthy(
  value: unknown,
) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "on"
  );
}

async function bnmcOriginalApplicationPost(
  request: Request,
) {
  try {
    const x =
      (await request.json()) as
        Record<string, unknown>;

    const guardianEmail =
      text(
        x.guardianEmail ??
        x.email,
      ).toLowerCase();

    const guardianPhone =
      text(
        x.guardianPhone ??
        x.phone,
      );

    const values = {
      firstName:
        text(x.firstName),

      lastName:
        text(x.lastName),

      dateOfBirth:
        text(x.dateOfBirth),

      gender:
        text(x.gender),

      ethnicGroup:
        text(x.ethnicGroup),

      guardianName:
        text(x.guardianName),

      guardianEmail,

      guardianPhone,

      relationship:
        text(x.relationship),

      postcode:
        text(x.postcode),

      emergencyContactNumber:
        text(
          x.emergencyContactNumber,
        ),
    };

    for (
      const [
        key,
        value,
      ] of Object.entries(
        values,
      )
    ) {
      if (!value) {
        return NextResponse.json(
          {
            error:
              `${key} is required`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const settings =
      await env.DB
        .prepare(
          `SELECT key, value
           FROM app_settings
           WHERE key IN (
             'application_fee_pence',
             'application_fee_required'
           )`,
        )
        .all<Record<string, unknown>>();

    const applicationFeePence =
      Math.max(
        0,
        Number(
          setting(
            settings,
            "application_fee_pence",
            "0",
          ),
        ) || 0,
      );

    const applicationFeeRequired =
      setting(
        settings,
        "application_fee_required",
        "false",
      ) === "true" &&
      applicationFeePence > 0;

    const studentId =
      crypto.randomUUID();

    const linkId =
      crypto.randomUUID();

    const applicationId =
      crypto.randomUUID();

    const registrationYear =
      new Date()
        .getUTCFullYear();

    const registrationPrefix =
      `BNMC-${registrationYear}-`;

    const lastRegistration =
      await env.DB
        .prepare(
          `SELECT
             MAX(
               CAST(
                 substr(
                   student_number,
                   11,
                   4
                 ) AS INTEGER
               )
             ) AS last_number
           FROM students
           WHERE
             student_number LIKE ?
             AND length(student_number) = 14`,
        )
        .bind(
          `${registrationPrefix}%`,
        )
        .first<{
          last_number:
            number | null;
        }>();

    /*
     * BNMC-2026-0090 is the established last number
     * before automated sequential registration begins.
     * From 2027 onward, each year starts from 0001.
     */
    const sequenceFloor =
      registrationYear === 2026
        ? 90
        : 0;

    const nextRegistrationNumber =
      Math.max(
        sequenceFloor,
        Number(
          lastRegistration
            ?.last_number ??
            0,
        ),
      ) + 1;

    const studentNumber =
      `${registrationPrefix}${String(
        nextRegistrationNumber,
      ).padStart(
        4,
        "0",
      )}`;

    const existingGuardian =
      await env.DB
        .prepare(
          `SELECT id
           FROM guardians
           WHERE lower(email) =
                 lower(?)
           LIMIT 1`,
        )
        .bind(
          guardianEmail,
        )
        .first<{
          id: string;
        }>();

    const guardianId =
      existingGuardian?.id ??
      crypto.randomUUID();

    const statements:
      D1PreparedStatement[] = [

      env.DB.prepare(
        `INSERT INTO students
        (
          id,
          student_number,
          first_name,
          last_name,
          date_of_birth,
          gender,
          ethnic_group,
          medical_notes,
          allergy_notes,
          additional_needs,
          photo_consent,
          emergency_consent,
          status
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'applicant'
        )`,
      ).bind(
        studentId,
        studentNumber,
        values.firstName,
        values.lastName,
        values.dateOfBirth,
        values.gender,
        values.ethnicGroup,

        text(
          x.medicalNotes,
        ) || null,

        text(
          x.allergyNotes,
        ) || null,

        text(
          x.additionalNeeds,
        ) || null,

        truthy(
          x.photoConsent,
        )
          ? 1
          : 0,

        truthy(
          x.emergencyConsent,
        )
          ? 1
          : 0,
      ),
    ];

    if (
      !existingGuardian
    ) {
      statements.push(

        env.DB.prepare(
          `INSERT INTO guardians
          (
            id,
            full_name,
            email,
            phone,
            address,
            postcode,
            emergency_contact_number,
            relationship
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
          )`,
        ).bind(
          guardianId,
          values.guardianName,
          guardianEmail,
          guardianPhone,

          text(
            x.address,
          ) || null,

          values.postcode,

          values
            .emergencyContactNumber,

          values.relationship,
        ),
      );
    }
    else {
      statements.push(

        env.DB.prepare(
          `UPDATE guardians
           SET
             full_name = ?,
             phone = ?,
             address =
               COALESCE(
                 ?,
                 address
               ),
             postcode = ?,
             emergency_contact_number = ?,
             relationship = ?,
             updated_at =
               CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(
          values.guardianName,
          guardianPhone,

          text(
            x.address,
          ) || null,

          values.postcode,

          values
            .emergencyContactNumber,

          values.relationship,
          guardianId,
        ),
      );
    }

    statements.push(

      env.DB.prepare(
        `INSERT INTO student_guardians
        (
          id,
          student_id,
          guardian_id,
          is_primary,
          authorised_collection
        )
        VALUES (
          ?, ?, ?, 1, 1
        )`,
      ).bind(
        linkId,
        studentId,
        guardianId,
      ),

      env.DB.prepare(
        `INSERT INTO applications
        (
          id,
          student_id,
          preferred_session,
          prior_level,
          status,
          application_fee_pence,
          payment_status,
          submitted_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )`,
      ).bind(
        applicationId,
        studentId,

        text(
          x.preferredSession,
        ) || null,

        text(
          x.priorLevel,
        ) || null,

        applicationFeeRequired
          ? "payment_pending"
          : "submitted",

        applicationFeePence,

        applicationFeeRequired
          ? "pending"
          : "not_required",

        applicationFeeRequired
          ? null
          : new Date()
              .toISOString(),
      ),
    );

    await env.DB.batch(
      statements,
    );

    return NextResponse.json(
      {
        ok: true,
        applicationId,
        studentNumber,
        paymentRequired:
          applicationFeeRequired,
        applicationFeePence,
      },
      {
        status: 201,
      },
    );
  }
  catch (error) {
    console.error(
      "Admission application failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to save application",
      },
      {
        status: 500,
      },
    );
  }
}
// BNMC_APPLICATION_RECEIPT_EMAIL
function bnmcReceiptText(value: unknown) { return String(value ?? "").trim(); }
function bnmcReceiptHtml(value: unknown) {
  return bnmcReceiptText(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] ?? char));
}
function bnmcReceiptPick(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = bnmcReceiptText(source[key]);
    if (value) return value;
  }
  return "";
}
async function bnmcSendApplicationReceipt(request: Request, payload: Record<string, unknown>, response: Response) {
  try {
    const runtimeModule = await import("cloudflare:workers");
    const runtime = runtimeModule.env as typeof runtimeModule.env & { RESEND_API_KEY?: string; EMAIL_FROM?: string };
    if (!runtime.RESEND_API_KEY || !runtime.EMAIL_FROM) return;

    const guardianEmail = bnmcReceiptPick(payload, "guardianEmail", "email").toLowerCase();
    if (!guardianEmail || !guardianEmail.includes("@")) return;

    const firstName = bnmcReceiptPick(payload, "firstName");
    const lastName = bnmcReceiptPick(payload, "lastName");
    const studentName = [firstName, lastName].filter(Boolean).join(" ") || "your child";
    const guardianName = bnmcReceiptPick(payload, "guardianName") || "Parent/Guardian";

    let result: Record<string, unknown> = {};
    try { result = await response.clone().json() as Record<string, unknown>; } catch {}
    const reference = bnmcReceiptPick(result, "reference", "applicationReference", "application_number", "applicationNumber", "studentNumber", "student_number", "id");
    const origin = new URL(request.url).origin;

    const safeGuardian = bnmcReceiptHtml(guardianName);
    const safeStudent = bnmcReceiptHtml(studentName);
    const safeReference = bnmcReceiptHtml(reference);
    const referenceHtml = reference ? '<p>Your application reference is <strong>' + safeReference + '</strong>.</p>' : '';
    const html = '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#20322a;line-height:1.6">' +
      '<div style="max-width:640px;margin:auto;padding:24px">' +
      '<h2 style="color:#173d31">Application received</h2>' +
      '<p>As-Salaamu alaykum ' + safeGuardian + ',</p>' +
      '<p>Thank you for submitting an application to <strong>BNMC Madrasah</strong> for <strong>' + safeStudent + '</strong>.</p>' +
      referenceHtml +
      '<p>We have received the application successfully. The Madrasah team will review it and contact you when there is an update.</p>' +
      '<p style="margin-top:24px"><a href="' + origin + '" style="display:inline-block;background:#173d31;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px">BNMC Madrasah</a></p>' +
      '<p>Jazakumullahu Khayran,<br/>BNMC Madrasah</p>' +
      '</div></body></html>';

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + runtime.RESEND_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: runtime.EMAIL_FROM,
        to: [guardianEmail],
        subject: "Application received - BNMC Madrasah" + (reference ? " (" + reference + ")" : ""),
        html,
      }),
    });
    if (!emailResponse.ok) {
      console.error("Application receipt email failed", emailResponse.status, await emailResponse.text());
    }
  } catch (error) {
    console.error("Application receipt email failed", error);
  }
}


type AdminRecipient = {
  id: string;
  display_name: string;
  email: string;
};

async function bnmcNotifyAdminsOfNewApplication(
  request: Request,
  payload: Record<string, unknown>,
  saved: Record<string, unknown>,
) {
  const admins =
    await env.DB
      .prepare(
        `SELECT DISTINCT
           u.id,
           u.display_name,
           lower(trim(u.email)) AS email
         FROM users u
         WHERE
           u.status = 'active'
           AND u.email IS NOT NULL
           AND trim(u.email) != ''
           AND lower(trim(u.email)) NOT LIKE '%.local'
           AND (
             u.role = 'admin'
             OR EXISTS (
               SELECT 1
               FROM user_roles ur
               WHERE
                 ur.user_id = u.id
                 AND ur.role = 'admin'
             )
           )
         ORDER BY u.display_name`,
      )
      .all<AdminRecipient>();

  if (
    !admins.results ||
    admins.results.length === 0
  ) {
    console.warn(
      "New application admin notification skipped: no active admin email addresses found.",
    );
    return;
  }

  const studentName =
    [
      bnmcReceiptPick(
        payload,
        "firstName",
      ),
      bnmcReceiptPick(
        payload,
        "lastName",
      ),
    ]
      .filter(Boolean)
      .join(" ") ||
    "Student";

  const applicationNumber =
    bnmcReceiptPick(
      saved,
      "studentNumber",
      "applicationNumber",
      "applicationReference",
      "reference",
    ) ||
    "Pending";

  const age =
    applicationAge(
      payload.dateOfBirth,
    ) ||
    "Not available";

  const gender =
    bnmcReceiptPick(
      payload,
      "gender",
    ) ||
    "Not available";

  const guardianPhone =
    bnmcReceiptPick(
      payload,
      "guardianPhone",
      "phone",
    ) ||
    "Not available";

  const applicationId =
    bnmcReceiptPick(
      saved,
      "applicationId",
      "id",
    );

  const portalUrl =
    `${new URL(
      request.url,
    ).origin}/portal`;

  const subject =
    `New BNMC Madrasah application - ${applicationNumber}`;

  const results =
    await Promise.allSettled(
      admins.results.map(
        async (
          admin,
        ) => {
          const adminName =
            admin.display_name
              ?.trim() ||
            "Admin";

          const textBody =
            `As-Salaamu alaykum ${adminName},

A new BNMC Madrasah application has been submitted.

Student: ${studentName}
Application No: ${applicationNumber}
Age: ${age}
Gender: ${gender}
Parent/Guardian Phone: ${guardianPhone}

Please log in to the BNMC Madrasah portal to review the application:
${portalUrl}

BNMC Madrasah`;

          const htmlBody =
            `<!doctype html>` +
            `<html><body style="font-family:Arial,sans-serif;color:#20322a;line-height:1.6">` +
            `<div style="max-width:640px;margin:auto;padding:24px">` +
            `<h2 style="color:#173d31;margin-bottom:8px">New Madrasah application</h2>` +
            `<p>As-Salaamu alaykum ${bnmcReceiptHtml(adminName)},</p>` +
            `<p>A new BNMC Madrasah application has been submitted.</p>` +
            `<table style="width:100%;border-collapse:collapse;margin:20px 0">` +
            `<tr><td style="padding:8px 0;color:#66756d">Student</td><td style="padding:8px 0;font-weight:700">${bnmcReceiptHtml(studentName)}</td></tr>` +
            `<tr><td style="padding:8px 0;color:#66756d">Application No.</td><td style="padding:8px 0;font-weight:700">${bnmcReceiptHtml(applicationNumber)}</td></tr>` +
            `<tr><td style="padding:8px 0;color:#66756d">Age</td><td style="padding:8px 0">${bnmcReceiptHtml(age)}</td></tr>` +
            `<tr><td style="padding:8px 0;color:#66756d">Gender</td><td style="padding:8px 0">${bnmcReceiptHtml(gender)}</td></tr>` +
            `<tr><td style="padding:8px 0;color:#66756d">Parent/Guardian Phone</td><td style="padding:8px 0">${bnmcReceiptHtml(guardianPhone)}</td></tr>` +
            `</table>` +
            `<p><a href="${bnmcReceiptHtml(portalUrl)}" style="display:inline-block;background:#173d31;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px;font-weight:700">Review application</a></p>` +
            `<p style="margin-top:24px">BNMC Madrasah</p>` +
            `</div></body></html>`;

          await sendTrackedEmail({
            to:
              admin.email,
            subject,
            text:
              textBody,
            html:
              htmlBody,
            emailType:
              "new_application_admin_alert",
            relatedEntityType:
              "application",
            relatedEntityId:
              applicationId ||
              applicationNumber,
            context: {
              applicationId:
                applicationId ||
                null,
              applicationNumber,
              studentName,
              requestOrigin:
                new URL(
                  request.url,
                ).origin,
            },
          });
        },
      ),
    );

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
        "rejected"
      ) {
        console.error(
          "New application admin email failed",
          admins.results[
            index
          ]?.email,
          result.reason,
        );
      }
    },
  );
}

export async function POST(request: Request) {
  const payload =
    await request
      .clone()
      .json()
      .catch(
        () => ({}),
      ) as
        Record<
          string,
          unknown
        >;

  const response =
    await bnmcOriginalApplicationPost(
      request,
    );

  if (
    response.ok
  ) {
    let saved:
      Record<
        string,
        unknown
      > = {};

    try {
      saved =
        await response
          .clone()
          .json() as
          Record<
            string,
            unknown
          >;
    }
    catch {}

    const notificationResults =
      await Promise.allSettled([
        bnmcSendApplicationReceipt(
          request,
          payload,
          response,
        ),

        bnmcNotifyAdminsOfNewApplication(
          request,
          payload,
          saved,
        ),
      ]);

    for (
      const result of
        notificationResults
    ) {
      if (
        result.status ===
        "rejected"
      ) {
        console.error(
          "Post-application notification failed",
          result.reason,
        );
      }
    }
  }

  return response;
}
