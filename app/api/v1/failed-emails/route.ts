import { env } from "cloudflare:workers";

import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  ApiError,
} from "@/lib/backend";
import { sendEmail } from "@/lib/email";
import { markTrackedEmailRetried } from "@/lib/email-delivery";
import {
  resendApplicationParentAccess,
  resendGuardianPortalSetup,
} from "@/lib/parent-access";

const runtimeEnv =
  env as unknown as {
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
  };

type SystemFailure = {
  id: string;
  recipient_email: string;
  email_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  subject: string;
  text_body: string;
  html_body: string | null;
  failure_reason: string | null;
  attempt_count: number;
  last_attempt_at: string;
  context_json: string | null;
};

type CommunicationFailure = {
  id: string;
  communication_id: string;
  email: string;
  email_error: string | null;
  created_at: string;
  title: string;
  body: string;
};

function niceType(value: string) {
  const labels:
    Record<string, string> = {
      admission_parent_setup:
        "Admission / parent setup",
      admission_confirmation:
        "Admission confirmation",
      parent_portal_setup:
        "Parent portal setup",
      parent_portal_access_added:
        "Parent portal access",
    };

  return labels[value] ??
    value
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      );
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(
        error ??
          "Email resend failed.",
      );
}

async function listFailures() {
  const system =
    await d1()
      .prepare(
        `select
           id,
           recipient_email,
           email_type,
           related_entity_type,
           related_entity_id,
           subject,
           text_body,
           html_body,
           failure_reason,
           attempt_count,
           last_attempt_at,
           context_json
         from email_delivery_log
         where status = 'failed'
         order by last_attempt_at desc
         limit 100`,
      )
      .all<SystemFailure>();

  const communications =
    await d1()
      .prepare(
        `select
           cr.id,
           cr.communication_id,
           cr.email,
           cr.email_error,
           cr.created_at,
           a.title,
           a.body
         from communication_recipients cr
         join announcements a
           on a.id =
              cr.communication_id
         where cr.email_status =
           'failed'
         order by cr.created_at desc
         limit 100`,
      )
      .all<CommunicationFailure>();

  return [
    ...system.results.map(
      (row) => ({
        id:
          row.id,
        source:
          "system",
        recipient:
          row.recipient_email,
        type:
          niceType(
            row.email_type,
          ),
        subject:
          row.subject,
        failureReason:
          row.failure_reason ??
          "Delivery failed.",
        attempts:
          Number(
            row.attempt_count ??
              1,
          ),
        failedAt:
          row.last_attempt_at,
      }),
    ),
    ...communications.results.map(
      (row) => ({
        id:
          row.id,
        source:
          "communication",
        recipient:
          row.email,
        type:
          "Communication",
        subject:
          row.title,
        failureReason:
          row.email_error ??
          "Delivery failed.",
        attempts:
          1,
        failedAt:
          row.created_at,
      }),
    ),
  ].sort(
    (left, right) =>
      String(
        right.failedAt,
      ).localeCompare(
        String(
          left.failedAt,
        ),
      ),
  );
}

async function resendCommunication(
  row: CommunicationFailure,
  requestOrigin: string,
) {
  const apiKey =
    String(
      runtimeEnv.RESEND_API_KEY ??
        "",
    ).trim();

  const from =
    String(
      runtimeEnv.EMAIL_FROM ??
        "",
    ).trim();

  if (
    !apiKey ||
    !from
  ) {
    throw new ApiError(
      500,
      "Email delivery is not configured.",
    );
  }

  const portalUrl =
    `${new URL(requestOrigin).origin}/portal`;

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method:
          "POST",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            from,
            to: [
              row.email,
            ],
            subject:
              row.title,
            text:
              `Assalamu alaikum,\n\n${row.body}\n\nYou can also view this message in the BNMC Madrasah portal: ${portalUrl}\n\nJazakumullahu Khayran,\nBNMC Madrasah`,
          }),
      },
    );

  const result =
    (await response
      .json()
      .catch(
        () => ({}),
      )) as {
      id?: string;
      message?: string;
      error?: {
        message?: string;
      };
    };

  if (
    !response.ok
  ) {
    throw new ApiError(
      502,
      result.error?.message ??
        result.message ??
        `Email provider returned ${response.status}.`,
    );
  }

  await d1().batch([
    d1()
      .prepare(
        `update communication_recipients
         set
           email_status =
             'sent',
           provider_message_id =
             ?,
           email_error =
             null,
           email_sent_at =
             CURRENT_TIMESTAMP
         where id = ?`,
      )
      .bind(
        result.id ??
          null,
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
               where communication_id = ?
                 and email_status = 'sent'
             ),
           email_failed_count =
             (
               select count(*)
               from communication_recipients
               where communication_id = ?
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
}

async function resendSystem(
  row: SystemFailure,
  requestOrigin: string,
) {
  const context =
    row.context_json
      ? JSON.parse(
          row.context_json,
        ) as Record<string, unknown>
      : {};

  if (
    row.email_type ===
      "admission_parent_setup"
  ) {
    const applicationId =
      String(
        context.applicationId ??
          row.related_entity_id ??
          "",
      );

    const result =
      await resendApplicationParentAccess(
        applicationId,
        requestOrigin,
      );

    if (
      result.status ===
      "failed"
    ) {
      throw new Error(
        result.message,
      );
    }

    return;
  }

  if (
    row.email_type ===
      "parent_portal_setup"
  ) {
    const guardianId =
      String(
        context.guardianId ??
          row.related_entity_id ??
          "",
      );

    const result =
      await resendGuardianPortalSetup(
        guardianId,
        requestOrigin,
      );

    if (
      result.status ===
      "failed"
    ) {
      throw new Error(
        result.message,
      );
    }

    return;
  }

  await sendEmail({
    to:
      row.recipient_email,
    subject:
      row.subject,
    text:
      row.text_body,
    html:
      row.html_body ??
      row.text_body,
  });
}

export async function GET(
  request: Request,
) {
  try {
    await actor(
      request,
      ["admin"],
    );

    return json({
      ok: true,
      data:
        await listFailures(),
    });
  }
  catch (error) {
    return fail(
      error,
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const who =
      await actor(
        request,
        ["admin"],
      );

    const input =
      await body(
        request,
      );

    const source =
      String(
        input.source ??
          "",
      );

    const id =
      String(
        input.id ??
          "",
      );

    if (
      ![
        "system",
        "communication",
      ].includes(
        source,
      ) ||
      !id
    ) {
      throw new ApiError(
        400,
        "A valid failed email is required.",
      );
    }

    if (
      source ===
      "communication"
    ) {
      const row =
        await d1()
          .prepare(
            `select
               cr.id,
               cr.communication_id,
               cr.email,
               cr.email_error,
               cr.created_at,
               a.title,
               a.body
             from communication_recipients cr
             join announcements a
               on a.id =
                  cr.communication_id
             where cr.id = ?
               and cr.email_status =
                 'failed'
             limit 1`,
          )
          .bind(
            id,
          )
          .first<CommunicationFailure>();

      if (
        !row
      ) {
        throw new ApiError(
          404,
          "Failed email was not found.",
        );
      }

      try {
        await resendCommunication(
          row,
          request.url,
        );
      }
      catch (error) {
        await d1()
          .prepare(
            `update communication_recipients
             set
               email_error = ?
             where id = ?`,
          )
          .bind(
            errorText(
              error,
            ).slice(
              0,
              1000,
            ),
            row.id,
          )
          .run();

        throw error;
      }

      await audit(
        who,
        "resend-failed-email",
        "communication_recipients",
        row.id,
        {
          recipient:
            row.email,
          communicationId:
            row.communication_id,
        },
      );
    }
    else {
      const row =
        await d1()
          .prepare(
            `select
               id,
               recipient_email,
               email_type,
               related_entity_type,
               related_entity_id,
               subject,
               text_body,
               html_body,
               failure_reason,
               attempt_count,
               last_attempt_at,
               context_json
             from email_delivery_log
             where id = ?
               and status =
                 'failed'
             limit 1`,
          )
          .bind(
            id,
          )
          .first<SystemFailure>();

      if (
        !row
      ) {
        throw new ApiError(
          404,
          "Failed email was not found.",
        );
      }

      try {
        await resendSystem(
          row,
          request.url,
        );

        await markTrackedEmailRetried(
          row.id,
          true,
        );
      }
      catch (error) {
        await markTrackedEmailRetried(
          row.id,
          false,
          errorText(
            error,
          ),
        );

        throw error;
      }

      await audit(
        who,
        "resend-failed-email",
        "email_delivery_log",
        row.id,
        {
          recipient:
            row.recipient_email,
          emailType:
            row.email_type,
        },
      );
    }

    return json({
      ok: true,
      message:
        "Email resent successfully.",
    });
  }
  catch (error) {
    return fail(
      error,
    );
  }
}
