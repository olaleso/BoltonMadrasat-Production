import { env } from "cloudflare:workers";

import { d1 } from "@/db";

type RuntimeEnv = {
  RESEND_WEBHOOK_SECRET?: string;
};

const runtimeEnv =
  env as unknown as RuntimeEnv;

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    message_id?: string;
    to?: string[];
    subject?: string;
    bounce?: {
      message?: string;
      type?: string;
      subType?: string;
    };
  };
};

function base64ToBytes(value: string) {
  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const padded =
    normalized +
    "=".repeat(
      (4 - (normalized.length % 4)) % 4,
    );

  const binary =
    atob(padded);

  return Uint8Array.from(
    binary,
    (character) =>
      character.charCodeAt(0),
  );
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary =
    "";

  for (
    const byte of new Uint8Array(bytes)
  ) {
    binary +=
      String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function validSvixSignature(
  request: Request,
  payload: string,
) {
  const secret =
    String(
      runtimeEnv.RESEND_WEBHOOK_SECRET ??
        "",
    ).trim();

  if (
    !secret
  ) {
    console.error(
      "RESEND_WEBHOOK_SECRET is not configured.",
    );
    return false;
  }

  const id =
    request.headers.get(
      "svix-id",
    );

  const timestamp =
    request.headers.get(
      "svix-timestamp",
    );

  const signatureHeader =
    request.headers.get(
      "svix-signature",
    );

  if (
    !id ||
    !timestamp ||
    !signatureHeader
  ) {
    return false;
  }

  const numericTimestamp =
    Number(
      timestamp,
    );

  if (
    !Number.isFinite(
      numericTimestamp,
    )
  ) {
    return false;
  }

  // Reject signatures older/newer than 5 minutes.
  const now =
    Math.floor(
      Date.now() /
        1000,
    );

  if (
    Math.abs(
      now -
        numericTimestamp,
    ) >
    300
  ) {
    return false;
  }

  const secretValue =
    secret.startsWith(
      "whsec_",
    )
      ? secret.slice(
          6,
        )
      : secret;

  let secretBytes:
    Uint8Array;

  try {
    secretBytes =
      base64ToBytes(
        secretValue,
      );
  }
  catch {
    return false;
  }

  const secretBuffer =
    new ArrayBuffer(
      secretBytes.byteLength,
    );

  new Uint8Array(
    secretBuffer,
  ).set(
    secretBytes,
  );

  const key =
    await crypto.subtle.importKey(
      "raw",
      secretBuffer,
      {
        name:
          "HMAC",
        hash:
          "SHA-256",
      },
      false,
      [
        "sign",
      ],
    );

  const signedContent =
    `${id}.${timestamp}.${payload}`;

  const digest =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder()
        .encode(
          signedContent,
        ),
    );

  const expected =
    bytesToBase64(
      digest,
    );

  const candidates =
    signatureHeader
      .split(" ")
      .map(
        (part) =>
          part.trim(),
      )
      .filter(
        Boolean,
      )
      .map(
        (part) =>
          part.startsWith(
            "v1,",
          )
            ? part.slice(
                3,
              )
            : part,
      );

  return candidates.some(
    (candidate) =>
      candidate ===
      expected,
  );
}

function failureReason(
  event: ResendEvent,
) {
  const bounce =
    event.data
      ?.bounce;

  if (
    bounce?.message
  ) {
    return bounce.message
      .slice(
        0,
        1000,
      );
  }

  if (
    event.type ===
      "email.complained"
  ) {
    return "Recipient marked the email as spam.";
  }

  if (
    event.type ===
      "email.suppressed"
  ) {
    return "Resend suppressed delivery to this recipient.";
  }

  if (
    event.type ===
      "email.failed"
  ) {
    return "Resend reported a failed email delivery.";
  }

  return "Email delivery bounced.";
}

async function markTrackedEmail(
  recipient: string,
  subject: string,
  status: "sent" | "failed",
  reason: string | null,
) {
  /*
   * email_delivery_log currently stores our app-generated delivery record,
   * but the original implementation did not store Resend's provider email ID.
   * Resend webhook payloads include recipient + subject, so we match the most
   * recent applicable record. This is reliable for BNMC transactional emails,
   * especially application alerts whose subjects contain the unique application
   * number.
   */
  const row =
    await d1()
      .prepare(
        `select id
         from email_delivery_log
         where
           lower(recipient_email) =
             lower(?)
           and subject = ?
           and created_at >=
             datetime(
               'now',
               '-7 day'
             )
         order by
           created_at desc
         limit 1`,
      )
      .bind(
        recipient,
        subject,
      )
      .first<{
        id: string;
      }>();

  if (
    !row
  ) {
    return false;
  }

  await d1()
    .prepare(
      `update email_delivery_log
       set
         status = ?,
         failure_reason = ?,
         last_attempt_at =
           CURRENT_TIMESTAMP,
         sent_at = case
           when ? = 'sent'
             then coalesce(
               sent_at,
               CURRENT_TIMESTAMP
             )
           else sent_at
         end,
         updated_at =
           CURRENT_TIMESTAMP
       where id = ?`,
    )
    .bind(
      status,
      reason,
      status,
      row.id,
    )
    .run();

  return true;
}

async function markCommunicationEmail(
  providerEmailId: string,
  recipient: string,
  status: "sent" | "failed",
  reason: string | null,
) {
  let row:
    {
      id: string;
      communication_id: string;
    } | null =
      null;

  if (
    providerEmailId
  ) {
    row =
      await d1()
        .prepare(
          `select
             id,
             communication_id
           from communication_recipients
           where
             provider_message_id = ?
           limit 1`,
        )
        .bind(
          providerEmailId,
        )
        .first<{
          id: string;
          communication_id: string;
        }>();
  }

  if (
    !row
  ) {
    return false;
  }

  await d1().batch([
    d1()
      .prepare(
        `update communication_recipients
         set
           email_status = ?,
           email_error = ?,
           email_sent_at = case
             when ? = 'sent'
               then coalesce(
                 email_sent_at,
                 CURRENT_TIMESTAMP
               )
             else email_sent_at
           end
         where id = ?`,
      )
      .bind(
        status,
        reason,
        status,
        row.id,
      ),

    d1()
      .prepare(
        `update announcements
         set
           email_sent_count =
             (
               select count(*)
               from communication_recipients
               where
                 communication_id = ?
                 and email_status = 'sent'
             ),
           email_failed_count =
             (
               select count(*)
               from communication_recipients
               where
                 communication_id = ?
                 and email_status = 'failed'
             ),
           updated_at =
             CURRENT_TIMESTAMP
         where id = ?`,
      )
      .bind(
        row.communication_id,
        row.communication_id,
        row.communication_id,
      ),
  ]);

  return true;
}

export async function POST(
  request: Request,
) {
  const payload =
    await request.text();

  if (
    !(await validSvixSignature(
      request,
      payload,
    ))
  ) {
    return new Response(
      "Invalid webhook signature",
      {
        status:
          401,
      },
    );
  }

  let event:
    ResendEvent;

  try {
    event =
      JSON.parse(
        payload,
      ) as
        ResendEvent;
  }
  catch {
    return new Response(
      "Invalid JSON",
      {
        status:
          400,
      },
    );
  }

  const recipient =
    String(
      event.data
        ?.to?.[0] ??
        "",
    ).trim();

  const subject =
    String(
      event.data
        ?.subject ??
        "",
    ).trim();

  const providerEmailId =
    String(
      event.data
        ?.email_id ??
        "",
    ).trim();

  if (
    !recipient
  ) {
    return Response.json({
      ok:
        true,
      ignored:
        true,
    });
  }

  const failedEvents =
    new Set([
      "email.bounced",
      "email.failed",
      "email.suppressed",
      "email.complained",
    ]);

  const deliveredEvents =
    new Set([
      "email.delivered",
    ]);

  if (
    failedEvents.has(
      event.type,
    )
  ) {
    const reason =
      failureReason(
        event,
      );

    if (
      subject
    ) {
      await markTrackedEmail(
        recipient,
        subject,
        "failed",
        reason,
      );
    }

    await markCommunicationEmail(
      providerEmailId,
      recipient,
      "failed",
      reason,
    );
  }
  else if (
    deliveredEvents.has(
      event.type,
    )
  ) {
    if (
      subject
    ) {
      await markTrackedEmail(
        recipient,
        subject,
        "sent",
        null,
      );
    }

    await markCommunicationEmail(
      providerEmailId,
      recipient,
      "sent",
      null,
    );
  }

  return Response.json({
    ok:
      true,
  });
}
