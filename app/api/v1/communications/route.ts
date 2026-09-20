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

const runtimeEnv = env as unknown as {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

type CommunicationKind = "message" | "announcement";
type AudienceType = "all_parents" | "class" | "guardian" | "student";
type Channel = "app" | "email" | "email_and_app";
type Action = "save_draft" | "send" | "publish";

type Recipient = {
  guardian_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  const parsed = text(value) as T;

  if (!allowed.includes(parsed)) {
    throw new ApiError(
      400,
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }

  return parsed;
}

function hasEmail(channel: Channel) {
  return channel === "email" || channel === "email_and_app";
}

function hasApp(channel: Channel) {
  return channel === "app" || channel === "email_and_app";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

async function all<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = d1().prepare(query);
  const result = bindings.length
    ? await statement.bind(...bindings).all<T>()
    : await statement.all<T>();

  return result.results;
}

async function first<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);

  return bindings.length
    ? await statement.bind(...bindings).first<T>()
    : await statement.first<T>();
}

async function classAllowedForTeacher(
  teacherId: string,
  classId: string,
) {
  const row = await first<{ id: string }>(
    `select id
     from classes
     where id = ?
       and teacher_id = ?
       and status = 'active'
     limit 1`,
    classId,
    teacherId,
  );

  return Boolean(row);
}

async function guardianAllowedForTeacher(
  teacherId: string,
  guardianId: string,
) {
  const row = await first<{ id: string }>(
    `select distinct g.id
     from guardians g
     join student_guardians sg
       on sg.guardian_id = g.id
      and sg.is_primary = 1
     join students s
       on s.id = sg.student_id
      and s.status = 'active'
     join enrolments e
       on e.student_id = s.id
      and e.status = 'active'
     join classes c
       on c.id = e.class_id
      and c.status = 'active'
     where g.id = ?
       and c.teacher_id = ?
     limit 1`,
    guardianId,
    teacherId,
  );

  return Boolean(row);
}

async function studentAllowedForTeacher(
  teacherId: string,
  studentId: string,
) {
  const row = await first<{ id: string }>(
    `select distinct s.id
     from students s
     join enrolments e
       on e.student_id = s.id
      and e.status = 'active'
     join classes c
       on c.id = e.class_id
      and c.status = 'active'
     where s.id = ?
       and s.status = 'active'
       and c.teacher_id = ?
     limit 1`,
    studentId,
    teacherId,
  );

  return Boolean(row);
}

async function resolveRecipients(
  who: { id: string; role: string },
  audienceType: AudienceType,
  targetId: string | null,
): Promise<Recipient[]> {
  if (who.role === "teacher" && audienceType === "all_parents") {
    throw new ApiError(
      403,
      "Teachers can send messages to parents in their assigned classes, not to all Madrasah parents.",
    );
  }

  if (audienceType !== "all_parents" && !targetId) {
    throw new ApiError(400, "Please select who should receive this communication.");
  }

  if (
    who.role === "teacher" &&
    audienceType === "class" &&
    !(await classAllowedForTeacher(who.id, targetId!))
  ) {
    throw new ApiError(403, "You can only contact parents in classes assigned to you.");
  }

  if (
    who.role === "teacher" &&
    audienceType === "guardian" &&
    !(await guardianAllowedForTeacher(who.id, targetId!))
  ) {
    throw new ApiError(403, "You can only contact parents linked to students in your classes.");
  }

  if (
    who.role === "teacher" &&
    audienceType === "student" &&
    !(await studentAllowedForTeacher(who.id, targetId!))
  ) {
    throw new ApiError(403, "You can only contact parents of students in your classes.");
  }

  let recipients: Recipient[] = [];

  if (audienceType === "all_parents") {
    recipients = await all<Recipient>(
      `select distinct
         g.id as guardian_id,
         g.user_id,
         g.full_name,
         lower(g.email) as email
       from guardians g
       join student_guardians sg
         on sg.guardian_id = g.id
        and sg.is_primary = 1
       join students s
         on s.id = sg.student_id
        and s.status = 'active'
       where trim(coalesce(g.email, '')) <> ''
       order by g.full_name`,
    );
  }

  if (audienceType === "class") {
    recipients = await all<Recipient>(
      `select distinct
         g.id as guardian_id,
         g.user_id,
         g.full_name,
         lower(g.email) as email
       from guardians g
       join student_guardians sg
         on sg.guardian_id = g.id
        and sg.is_primary = 1
       join students s
         on s.id = sg.student_id
        and s.status = 'active'
       join enrolments e
         on e.student_id = s.id
        and e.status = 'active'
       where e.class_id = ?
         and trim(coalesce(g.email, '')) <> ''
       order by g.full_name`,
      targetId,
    );
  }

  if (audienceType === "guardian") {
    recipients = await all<Recipient>(
      `select
         g.id as guardian_id,
         g.user_id,
         g.full_name,
         lower(g.email) as email
       from guardians g
       where g.id = ?
         and trim(coalesce(g.email, '')) <> ''
       limit 1`,
      targetId,
    );
  }

  if (audienceType === "student") {
    recipients = await all<Recipient>(
      `select distinct
         g.id as guardian_id,
         g.user_id,
         g.full_name,
         lower(g.email) as email
       from students s
       join student_guardians sg
         on sg.student_id = s.id
        and sg.is_primary = 1
       join guardians g
         on g.id = sg.guardian_id
       where s.id = ?
         and s.status = 'active'
         and trim(coalesce(g.email, '')) <> ''
       limit 1`,
      targetId,
    );
  }

  const deduped = new Map<string, Recipient>();

  for (const recipient of recipients) {
    const key = recipient.email.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, recipient);
    }
  }

  return [...deduped.values()];
}

async function audienceLabel(
  audienceType: AudienceType,
  targetId: string | null,
) {
  if (audienceType === "all_parents") {
    return "All parents";
  }

  if (!targetId) {
    return "Parents";
  }

  if (audienceType === "class") {
    const row = await first<{ name: string }>(
      "select name from classes where id = ? limit 1",
      targetId,
    );
    return row ? `${row.name} parents` : "Class parents";
  }

  if (audienceType === "guardian") {
    const row = await first<{ full_name: string }>(
      "select full_name from guardians where id = ? limit 1",
      targetId,
    );
    return row?.full_name ?? "Selected parent";
  }

  const row = await first<{ name: string }>(
    `select first_name || ' ' || last_name as name
     from students
     where id = ?
     limit 1`,
    targetId,
  );
  return row ? `Parent of ${row.name}` : "Parent of selected student";
}

async function sendEmailBatches({
  subject,
  message,
  recipients,
  portalUrl,
}: {
  subject: string;
  message: string;
  recipients: Recipient[];
  portalUrl: string;
}) {
  const apiKey = text(runtimeEnv.RESEND_API_KEY);
  const from = text(runtimeEnv.EMAIL_FROM);

  if (!apiKey || !from) {
    throw new ApiError(
      500,
      "Email delivery is not configured. RESEND_API_KEY and EMAIL_FROM are required.",
    );
  }

  const statuses = new Map<
    string,
    {
      status: "sent" | "failed";
      providerId: string | null;
      error: string | null;
    }
  >();

  const safeBody = escapeHtml(message).replaceAll(
    "\n",
    "<br />",
  );
  const safePortalUrl = escapeHtml(portalUrl);

  /*
   * IMPORTANT:
   * Do not send parents through BCC.
   *
   * Resend validates BCC more strictly in some sending contexts and the
   * previous bulk implementation caused every parent email to be rejected
   * with HTTP 422.
   *
   * The Resend batch endpoint lets us send separate, individually-addressed
   * emails in only a few provider requests. Each parent therefore gets their
   * own email and their own provider message ID.
   */
  for (const batch of chunks(recipients, 40)) {
    const emailPayloads = batch.map((recipient) => ({
      from,
      to: [recipient.email],
      subject,
      text:
        `Assalamu alaikum,\n\n${message}\n\n` +
        `You can also view this message in the BNMC Madrasah portal: ${portalUrl}\n\n` +
        `Jazakumullahu Khayran,\nBNMC Madrasah`,
      html:
        `<p>Assalamu alaikum,</p>` +
        `<p>${safeBody}</p>` +
        `<p>You can also view this message in the ` +
        `<a href="${safePortalUrl}">BNMC Madrasah portal</a>.</p>` +
        `<p>Jazakumullahu Khayran,<br />` +
        `<strong>BNMC Madrasah</strong></p>`,
    }));

    try {
      const response = await fetch(
        "https://api.resend.com/emails/batch",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayloads),
        },
      );

      const result =
        (await response
          .json()
          .catch(() => ({}))) as {
          data?: Array<{
            id?: string;
          }>;
          message?: string;
          error?: {
            message?: string;
          };
        };

      if (!response.ok) {
        const reason =
          result.error?.message ??
          result.message ??
          `Email provider returned ${response.status}`;

        for (const recipient of batch) {
          statuses.set(recipient.email, {
            status: "failed",
            providerId: null,
            error: reason,
          });
        }

        continue;
      }

      const providerResults =
        Array.isArray(result.data)
          ? result.data
          : [];

      for (let index = 0; index < batch.length; index += 1) {
        const recipient = batch[index];
        const providerResult = providerResults[index];

        statuses.set(recipient.email, {
          status: "sent",
          providerId: providerResult?.id ?? null,
          error: null,
        });
      }
    }
    catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Unable to contact email provider";

      for (const recipient of batch) {
        statuses.set(recipient.email, {
          status: "failed",
          providerId: null,
          error: reason,
        });
      }
    }
  }

  return statuses;
}

export async function GET(request: Request) {
  try {
    const who = await actor(request, ["admin", "teacher", "parent"]);
    const url = new URL(request.url);
    const communicationId = text(url.searchParams.get("id"));

    if (who.role === "parent") {
      const data = await all(
        `select distinct
           a.id,
           a.title,
           a.body,
           a.kind,
           a.audience,
           a.audience_type,
           a.channel,
           a.status,
           a.sent_at,
           a.created_at,
           u.display_name as author,
           r.read_at,
           case when r.read_at is null then 0 else 1 end as is_read,
           case when r.id is null then 1 else 0 end as legacy
         from announcements a
         left join users u
           on u.id = a.author_id
         left join communication_recipients r
           on r.communication_id = a.id
          and r.user_id = ?
         where
           (
             r.user_id = ?
             and r.app_status = 'available'
             and a.status in ('sent', 'published')
           )
           or
           (
             a.kind = 'announcement'
             and a.status = 'published'
             and a.audience in ('all', 'parents')
             and not exists (
               select 1
               from communication_recipients legacy_r
               where legacy_r.communication_id = a.id
             )
           )
         order by coalesce(a.sent_at, a.created_at) desc`,
        who.id,
        who.id,
      );

      return json({ ok: true, data });
    }

    if (communicationId) {
      const communication = await first<{
        id: string;
        author_id: string | null;
      }>(
        `select id, author_id
         from announcements
         where id = ?
         limit 1`,
        communicationId,
      );

      if (!communication) {
        throw new ApiError(404, "Communication not found.");
      }

      if (who.role === "teacher" && communication.author_id !== who.id) {
        throw new ApiError(403, "Teachers can only view recipient details for their own communications.");
      }

      const recipients = await all(
        `select
           r.id,
           r.guardian_id,
           r.user_id,
           r.email,
           r.email_status,
           r.email_error,
           r.app_status,
           r.read_at,
           r.created_at,
           g.full_name as guardian_name
         from communication_recipients r
         left join guardians g
           on g.id = r.guardian_id
         where r.communication_id = ?
         order by coalesce(g.full_name, r.email)`,
        communicationId,
      );

      return json({ ok: true, recipients });
    }

    const data =
      who.role === "teacher"
        ? await all(
            `select
               a.*,
               u.display_name as author
             from announcements a
             left join users u
               on u.id = a.author_id
             where a.author_id = ?
             order by a.created_at desc`,
            who.id,
          )
        : await all(
            `select
               a.*,
               u.display_name as author
             from announcements a
             left join users u
               on u.id = a.author_id
             order by a.created_at desc`,
          );

    const classes =
      who.role === "teacher"
        ? await all(
            `select id, name
             from classes
             where status = 'active'
               and teacher_id = ?
             order by name`,
            who.id,
          )
        : await all(
            `select id, name
             from classes
             where status = 'active'
             order by name`,
          );

    const guardians =
      who.role === "teacher"
        ? await all(
            `select distinct
               g.id,
               g.full_name as name,
               g.email
             from guardians g
             join student_guardians sg
               on sg.guardian_id = g.id
              and sg.is_primary = 1
             join students s
               on s.id = sg.student_id
              and s.status = 'active'
             join enrolments e
               on e.student_id = s.id
              and e.status = 'active'
             join classes c
               on c.id = e.class_id
              and c.status = 'active'
             where c.teacher_id = ?
             order by g.full_name`,
            who.id,
          )
        : await all(
            `select distinct
               g.id,
               g.full_name as name,
               g.email
             from guardians g
             join student_guardians sg
               on sg.guardian_id = g.id
              and sg.is_primary = 1
             join students s
               on s.id = sg.student_id
              and s.status = 'active'
             order by g.full_name`,
          );

    const students =
      who.role === "teacher"
        ? await all(
            `select distinct
               s.id,
               s.first_name || ' ' || s.last_name as name,
               s.student_number
             from students s
             join enrolments e
               on e.student_id = s.id
              and e.status = 'active'
             join classes c
               on c.id = e.class_id
              and c.status = 'active'
             where s.status = 'active'
               and c.teacher_id = ?
             order by s.last_name, s.first_name`,
            who.id,
          )
        : await all(
            `select
               s.id,
               s.first_name || ' ' || s.last_name as name,
               s.student_number
             from students s
             where s.status = 'active'
             order by s.last_name, s.first_name`,
          );

    return json({
      ok: true,
      data,
      options: {
        classes,
        guardians,
        students,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin", "teacher"]);
    const x = await body(request);

    const action = oneOf<Action>(
      x.action,
      ["save_draft", "send", "publish"],
      "Action",
    );
    const kind = oneOf<CommunicationKind>(
      x.kind,
      ["message", "announcement"],
      "Communication type",
    );
    const audienceType = oneOf<AudienceType>(
      x.audienceType,
      ["all_parents", "class", "guardian", "student"],
      "Audience",
    );
    const channel = oneOf<Channel>(
      x.channel,
      ["app", "email", "email_and_app"],
      "Delivery method",
    );

    if (kind === "message" && action === "publish") {
      throw new ApiError(400, "Messages must be sent, not published.");
    }

    if (kind === "announcement" && action === "send") {
      throw new ApiError(400, "Announcements must be published, not sent.");
    }

    const title = text(x.title);
    const message = text(x.body ?? x.message);
    const targetId = text(x.targetId) || null;
    const requestedId = text(x.id) || null;

    if (!title) {
      throw new ApiError(400, "Subject/title is required.");
    }

    if (!message) {
      throw new ApiError(400, "Message is required.");
    }

    if (audienceType !== "all_parents" && !targetId) {
      throw new ApiError(400, "Please select the intended recipient or class.");
    }

    if (action !== "save_draft" && hasEmail(channel) && (!text(runtimeEnv.RESEND_API_KEY) || !text(runtimeEnv.EMAIL_FROM))) {
      throw new ApiError(
        500,
        "Email delivery is not configured. Please configure RESEND_API_KEY and EMAIL_FROM, or choose In-app only.",
      );
    }

    if (requestedId) {
      const existing = await first<{
        id: string;
        status: string;
        author_id: string | null;
      }>(
        `select id, status, author_id
         from announcements
         where id = ?
         limit 1`,
        requestedId,
      );

      if (!existing) {
        throw new ApiError(404, "Draft communication not found.");
      }

      if (existing.status !== "draft") {
        throw new ApiError(409, "Only draft communications can be edited or sent again.");
      }

      if (who.role === "teacher" && existing.author_id !== who.id) {
        throw new ApiError(403, "You can only edit your own draft communications.");
      }
    }

    const label = await audienceLabel(audienceType, targetId);
    const id = requestedId ?? crypto.randomUUID();

    if (action === "save_draft") {
      if (requestedId) {
        await d1()
          .prepare(
            `update announcements
             set
               title = ?,
               body = ?,
               audience = ?,
               kind = ?,
               audience_type = ?,
               target_id = ?,
               channel = ?,
               status = 'draft',
               sent_at = null,
               recipient_count = 0,
               email_sent_count = 0,
               email_failed_count = 0,
               updated_at = CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            title,
            message,
            label,
            kind,
            audienceType,
            targetId,
            channel,
            id,
          )
          .run();

        await d1()
          .prepare("delete from communication_recipients where communication_id = ?")
          .bind(id)
          .run();
      } else {
        await d1()
          .prepare(
            `insert into announcements
               (
                 id,
                 title,
                 body,
                 audience,
                 status,
                 author_id,
                 kind,
                 audience_type,
                 target_id,
                 channel,
                 recipient_count,
                 email_sent_count,
                 email_failed_count
               )
             values (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0, 0, 0)`,
          )
          .bind(
            id,
            title,
            message,
            label,
            who.id,
            kind,
            audienceType,
            targetId,
            channel,
          )
          .run();
      }

      await audit(who, "save-draft", "communication", id, {
        kind,
        audienceType,
        targetId,
        channel,
      });

      return json({
        ok: true,
        id,
        status: "draft",
        message: `${kind === "message" ? "Message" : "Announcement"} saved as draft.`,
      });
    }

    const recipients = await resolveRecipients(who, audienceType, targetId);

    if (!recipients.length) {
      throw new ApiError(
        409,
        "No parent/guardian recipients were found for the selected audience.",
      );
    }

    const status = kind === "message" ? "sent" : "published";
    const db = d1();
    const statements = [];

    if (requestedId) {
      statements.push(
        db
          .prepare(
            `update announcements
             set
               title = ?,
               body = ?,
               audience = ?,
               status = ?,
               kind = ?,
               audience_type = ?,
               target_id = ?,
               channel = ?,
               sent_at = CURRENT_TIMESTAMP,
               recipient_count = ?,
               email_sent_count = 0,
               email_failed_count = 0,
               updated_at = CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            title,
            message,
            label,
            status,
            kind,
            audienceType,
            targetId,
            channel,
            recipients.length,
            id,
          ),
      );

      statements.push(
        db
          .prepare("delete from communication_recipients where communication_id = ?")
          .bind(id),
      );
    } else {
      statements.push(
        db
          .prepare(
            `insert into announcements
               (
                 id,
                 title,
                 body,
                 audience,
                 status,
                 author_id,
                 kind,
                 audience_type,
                 target_id,
                 channel,
                 sent_at,
                 recipient_count,
                 email_sent_count,
                 email_failed_count
               )
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 0, 0)`,
          )
          .bind(
            id,
            title,
            message,
            label,
            status,
            who.id,
            kind,
            audienceType,
            targetId,
            channel,
            recipients.length,
          ),
      );
    }

    for (const recipient of recipients) {
      statements.push(
        db
          .prepare(
            `insert into communication_recipients
               (
                 id,
                 communication_id,
                 guardian_id,
                 user_id,
                 email,
                 email_status,
                 app_status
               )
             values (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            recipient.guardian_id,
            recipient.user_id,
            recipient.email,
            hasEmail(channel) ? "pending" : "not_requested",
            hasApp(channel) ? "available" : "not_requested",
          ),
      );
    }

    await db.batch(statements);

    let emailSentCount = 0;
    let emailFailedCount = 0;

    if (hasEmail(channel)) {
      const statuses = await sendEmailBatches({
        subject: title,
        message,
        recipients,
        portalUrl: `${new URL(request.url).origin}/portal`,
      });

      const updates = [];

      for (const recipient of recipients) {
        const delivery = statuses.get(recipient.email) ?? {
          status: "failed" as const,
          providerId: null,
          error: "Email delivery result was not returned.",
        };

        if (delivery.status === "sent") {
          emailSentCount += 1;
        } else {
          emailFailedCount += 1;
        }

        updates.push(
          db
            .prepare(
              `update communication_recipients
               set
                 email_status = ?,
                 provider_message_id = ?,
                 email_error = ?,
                 email_sent_at = case when ? = 'sent' then CURRENT_TIMESTAMP else email_sent_at end
               where communication_id = ?
                 and lower(email) = lower(?)`,
            )
            .bind(
              delivery.status,
              delivery.providerId,
              delivery.error,
              delivery.status,
              id,
              recipient.email,
            ),
        );
      }

      updates.push(
        db
          .prepare(
            `update announcements
             set
               email_sent_count = ?,
               email_failed_count = ?,
               updated_at = CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(emailSentCount, emailFailedCount, id),
      );

      await db.batch(updates);
    }

    await audit(who, kind === "message" ? "send-message" : "publish-announcement", "communication", id, {
      kind,
      audienceType,
      targetId,
      channel,
      recipientCount: recipients.length,
      emailSentCount,
      emailFailedCount,
    });

    const appCount = hasApp(channel)
      ? recipients.filter((recipient) => Boolean(recipient.user_id)).length
      : 0;

    return json({
      ok: true,
      id,
      status,
      recipientCount: recipients.length,
      emailSentCount,
      emailFailedCount,
      appCount,
      message:
        kind === "message"
          ? `Message sent to ${recipients.length} parent${recipients.length === 1 ? "" : "s"}.`
          : `Announcement published for ${recipients.length} parent${recipients.length === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const who = await actor(request, ["parent"]);
    const x = await body(request);
    const id = text(x.id);

    if (!id) {
      throw new ApiError(400, "Communication ID is required.");
    }

    const result = await d1()
      .prepare(
        `update communication_recipients
         set read_at = coalesce(read_at, CURRENT_TIMESTAMP)
         where communication_id = ?
           and user_id = ?
           and app_status = 'available'`,
      )
      .bind(id, who.id)
      .run();

    if (!result.meta.changes) {
      const legacy = await first<{ id: string }>(
        `select id
         from announcements
         where id = ?
           and kind = 'announcement'
           and status = 'published'
           and audience in ('all', 'parents')
         limit 1`,
        id,
      );

      if (!legacy) {
        throw new ApiError(404, "Message not found.");
      }
    }

    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const who = await actor(
      request,
      ["admin", "teacher"],
    );

    const x = await body(request);
    const id = text(x.id);

    if (!id) {
      throw new ApiError(
        400,
        "Communication ID is required.",
      );
    }

    const existing =
      await first<{
        id: string;
        title: string;
        kind: string;
        status: string;
        author_id: string | null;
      }>(
        `select
           id,
           title,
           kind,
           status,
           author_id
         from announcements
         where id = ?
         limit 1`,
        id,
      );

    if (!existing) {
      throw new ApiError(
        404,
        "Communication not found.",
      );
    }

    if (
      who.role === "teacher" &&
      existing.author_id !== who.id
    ) {
      throw new ApiError(
        403,
        "You can only delete communications you created.",
      );
    }

    await d1().batch([
      d1()
        .prepare(
          `delete from communication_recipients
           where communication_id = ?`,
        )
        .bind(id),

      d1()
        .prepare(
          `delete from announcements
           where id = ?`,
        )
        .bind(id),
    ]);

    await audit(
      who,
      "delete-communication",
      "communication",
      id,
      {
        kind:
          existing.kind,
        status:
          existing.status,
        title:
          existing.title,
      },
    );

    return json({
      ok: true,
      message:
        existing.status === "draft"
          ? "Draft deleted."
          : `${
              existing.kind === "message"
                ? "Message"
                : "Announcement"
            } removed from the portal. Emails already delivered cannot be recalled.`,
    });
  } catch (error) {
    return fail(error);
  }
}

