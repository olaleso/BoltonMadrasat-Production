import { d1 } from "@/db";
import { sendEmail } from "@/lib/email";

export type TrackedEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  emailType: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  context?: Record<string, unknown> | null;
};

function errorText(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return String(error ?? "Email delivery failed.").slice(0, 1000);
}

export async function sendTrackedEmail(
  input: TrackedEmailInput,
) {
  const id =
    crypto.randomUUID();

  const contextJson =
    input.context
      ? JSON.stringify(input.context)
      : null;

  try {
    await sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html:
        input.html ??
        input.text,
    });

    await d1()
      .prepare(
        `insert into email_delivery_log
           (
             id,
             recipient_email,
             email_type,
             related_entity_type,
             related_entity_id,
             subject,
             text_body,
             html_body,
             status,
             failure_reason,
             attempt_count,
             last_attempt_at,
             sent_at,
             context_json,
             updated_at
           )
         values
           (
             ?, ?, ?, ?, ?,
             ?, ?, ?, 'sent',
             null, 1,
             CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP,
             ?,
             CURRENT_TIMESTAMP
           )`,
      )
      .bind(
        id,
        input.to,
        input.emailType,
        input.relatedEntityType ?? null,
        input.relatedEntityId ?? null,
        input.subject,
        input.text,
        input.html ?? null,
        contextJson,
      )
      .run();

    return {
      id,
      status: "sent" as const,
    };
  }
  catch (error) {
    const reason =
      errorText(error);

    try {
      await d1()
        .prepare(
          `insert into email_delivery_log
             (
               id,
               recipient_email,
               email_type,
               related_entity_type,
               related_entity_id,
               subject,
               text_body,
               html_body,
               status,
               failure_reason,
               attempt_count,
               last_attempt_at,
               context_json,
               updated_at
             )
           values
             (
               ?, ?, ?, ?, ?,
               ?, ?, ?, 'failed',
               ?, 1,
               CURRENT_TIMESTAMP,
               ?,
               CURRENT_TIMESTAMP
             )`,
        )
        .bind(
          id,
          input.to,
          input.emailType,
          input.relatedEntityType ?? null,
          input.relatedEntityId ?? null,
          input.subject,
          input.text,
          input.html ?? null,
          reason,
          contextJson,
        )
        .run();
    }
    catch (logError) {
      console.error(
        "Unable to record failed email delivery",
        logError,
      );
    }

    throw error;
  }
}

export async function markTrackedEmailRetried(
  id: string,
  success: boolean,
  failureReason?: string | null,
) {
  await d1()
    .prepare(
      `update email_delivery_log
       set
         status = ?,
         failure_reason = ?,
         attempt_count = attempt_count + 1,
         last_attempt_at = CURRENT_TIMESTAMP,
         sent_at = case
           when ? = 'sent'
             then CURRENT_TIMESTAMP
           else sent_at
         end,
         updated_at = CURRENT_TIMESTAMP
       where id = ?`,
    )
    .bind(
      success ? "sent" : "failed",
      success
        ? null
        : (failureReason ?? "Email resend failed.").slice(0, 1000),
      success ? "sent" : "failed",
      id,
    )
    .run();
}
