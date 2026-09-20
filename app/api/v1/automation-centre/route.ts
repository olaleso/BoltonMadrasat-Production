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

const runtimeEnv = env as unknown as Record<string, string | undefined>;

type Candidate = Record<string, unknown>;

type ParentRecipient = {
  guardian_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
};

const defaults: Record<string, string> = {
  fee_reminder_enabled: "true",
  fee_reminder_days_overdue: "7",
  compliance_reminder_enabled: "true",
  compliance_reminder_days: "30",
  absence_alert_enabled: "true",
  absence_alert_threshold: "2",
  scheduled_report_enabled: "false",
  scheduled_report_cadence: "weekly",
  scheduled_report_day: "Monday",
  scheduled_report_recipient: "",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return ["true", "1", "yes", "on"].includes(text(value).toLowerCase());
}

function integer(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function isoDateOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(pence: unknown) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence ?? 0) / 100);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function settings() {
  const rows = await d1()
    .prepare(
      `select key, value
       from app_settings
       where key in (${Object.keys(defaults).map(() => "?").join(",")})`,
    )
    .bind(...Object.keys(defaults))
    .all<{ key: string; value: string }>();

  const result = { ...defaults };
  for (const row of rows.results ?? []) {
    result[row.key] = text(row.value);
  }
  return result;
}

async function notificationPreferences(userId: string | null) {
  const fallback = {
    appMessages: true,
    emailMessages: true,
    feeReminders: true,
    attendanceAlerts: true,
    weeklySummary: false,
  };

  if (!userId) return fallback;

  const row = await d1()
    .prepare("select value from app_settings where key = ? limit 1")
    .bind(`notification_preferences:${userId}`)
    .first<{ value: string }>();

  if (!row?.value) return fallback;

  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    return {
      appMessages: parsed.appMessages !== false,
      emailMessages: parsed.emailMessages !== false,
      feeReminders: parsed.feeReminders !== false,
      attendanceAlerts: parsed.attendanceAlerts !== false,
      weeklySummary: parsed.weeklySummary === true,
    };
  } catch {
    return fallback;
  }
}

async function feeCandidates(daysOverdue: number) {
  const cutoff = isoDateOffset(-daysOverdue);
  const result = await d1()
    .prepare(
      `select
         fi.id as invoice_id,
         fi.student_id,
         fi.due_date,
         (fi.amount_due_pence - fi.amount_paid_pence) as balance_pence,
         s.student_number,
         s.first_name || ' ' || s.last_name as student_name,
         g.id as guardian_id,
         g.user_id,
         g.full_name as guardian_name,
         lower(g.email) as guardian_email
       from fee_invoices fi
       join students s on s.id = fi.student_id
       left join student_guardians sg
         on sg.student_id = s.id and sg.is_primary = 1
       left join guardians g on g.id = sg.guardian_id
       where fi.status in ('pending', 'part_paid', 'overdue')
         and fi.amount_due_pence > fi.amount_paid_pence
         and date(fi.due_date) <= date(?)
         and s.status = 'active'
         and trim(coalesce(g.email, '')) <> ''
       order by g.full_name, s.last_name, s.first_name`,
    )
    .bind(cutoff)
    .all<Candidate>();
  return result.results ?? [];
}

async function complianceCandidates(days: number) {
  const end = isoDateOffset(days);
  const result = await d1()
    .prepare(
      `select
         c.id,
         c.check_type,
         c.status,
         c.expires_at,
         u.id as user_id,
         u.display_name,
         lower(u.email) as email
       from compliance c
       join users u on u.id = c.user_id
       where c.expires_at is not null
         and date(c.expires_at) between date('now') and date(?)
         and u.status = 'active'
         and trim(coalesce(u.email, '')) <> ''
       order by date(c.expires_at), u.display_name`,
    )
    .bind(end)
    .all<Candidate>();
  return result.results ?? [];
}

async function absenceCandidates(threshold: number) {
  const result = await d1()
    .prepare(
      `select
         s.id as student_id,
         s.student_number,
         s.first_name || ' ' || s.last_name as student_name,
         count(*) as absence_count,
         max(a.session_date) as last_absence,
         g.id as guardian_id,
         g.user_id,
         g.full_name as guardian_name,
         lower(g.email) as guardian_email
       from attendance a
       join students s on s.id = a.student_id
       left join student_guardians sg
         on sg.student_id = s.id and sg.is_primary = 1
       left join guardians g on g.id = sg.guardian_id
       where lower(a.status) = 'absent'
         and date(a.session_date) >= date('now', '-30 day')
         and s.status = 'active'
         and trim(coalesce(g.email, '')) <> ''
       group by
         s.id,
         s.student_number,
         s.first_name,
         s.last_name,
         g.id,
         g.user_id,
         g.full_name,
         g.email
       having count(*) >= ?
       order by count(*) desc, s.last_name, s.first_name`,
    )
    .bind(threshold)
    .all<Candidate>();
  return result.results ?? [];
}

async function sendEmail(to: string, subject: string, message: string, portalUrl?: string) {
  const apiKey = text(runtimeEnv.RESEND_API_KEY ?? process.env.RESEND_API_KEY);
  const from = text(runtimeEnv.EMAIL_FROM ?? process.env.EMAIL_FROM);

  if (!apiKey || !from) {
    return {
      status: "failed" as const,
      providerId: null,
      error: "Email delivery is not configured.",
    };
  }

  const safe = escapeHtml(message).replaceAll("\n", "<br />");
  const portal = portalUrl
    ? `<p>You can also sign in to the <a href="${escapeHtml(portalUrl)}">BNMC Madrasah portal</a>.</p>`
    : "";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: `Assalamu alaikum,\n\n${message}\n\nJazakumullahu Khayran,\nBNMC Madrasah`,
        html: `<p>Assalamu alaikum,</p><p>${safe}</p>${portal}<p>Jazakumullahu Khayran,<br /><strong>BNMC Madrasah</strong></p>`,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        status: "failed" as const,
        providerId: null,
        error:
          result.error?.message ??
          result.message ??
          `Email provider returned ${response.status}`,
      };
    }

    return {
      status: "sent" as const,
      providerId: result.id ?? null,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed" as const,
      providerId: null,
      error: error instanceof Error ? error.message : "Unable to contact email provider.",
    };
  }
}

async function recentlyMessaged(guardianId: string, title: string) {
  const row = await d1()
    .prepare(
      `select 1
       from announcements
       where kind = 'message'
         and audience_type = 'guardian'
         and target_id = ?
         and title = ?
         and datetime(sent_at) >= datetime('now', '-7 day')
       limit 1`,
    )
    .bind(guardianId, title)
    .first();
  return Boolean(row);
}

async function recentlyRemindedCompliance(complianceId: string) {
  const row = await d1()
    .prepare(
      `select 1
       from audit_log
       where action = 'automated-compliance-reminder'
         and entity_type = 'compliance'
         and entity_id = ?
         and datetime(created_at) >= datetime('now', '-7 day')
       limit 1`,
    )
    .bind(complianceId)
    .first();

  return Boolean(row);
}

async function sendParentMessage({
  authorId,
  recipient,
  title,
  message,
  preferenceKey,
  portalUrl,
}: {
  authorId: string;
  recipient: ParentRecipient;
  title: string;
  message: string;
  preferenceKey: "feeReminders" | "attendanceAlerts";
  portalUrl: string;
}) {
  const prefs = await notificationPreferences(recipient.user_id);
  if (!prefs[preferenceKey]) {
    return { skipped: true, emailSent: 0, emailFailed: 0, appCount: 0 };
  }

  const useApp = prefs.appMessages && Boolean(recipient.user_id);
  const useEmail = prefs.emailMessages && Boolean(recipient.email);

  if (!useApp && !useEmail) {
    return { skipped: true, emailSent: 0, emailFailed: 0, appCount: 0 };
  }

  const communicationId = crypto.randomUUID();
  const recipientId = crypto.randomUUID();
  const channel = useApp && useEmail ? "email_and_app" : useEmail ? "email" : "app";
  const db = d1();

  await db.batch([
    db
      .prepare(
        `insert into announcements
           (id, title, body, audience, status, author_id, kind, audience_type,
            target_id, channel, sent_at, recipient_count, email_sent_count, email_failed_count)
         values (?, ?, ?, ?, 'sent', ?, 'message', 'guardian', ?, ?, CURRENT_TIMESTAMP, 1, 0, 0)`,
      )
      .bind(
        communicationId,
        title,
        message,
        recipient.full_name,
        authorId,
        recipient.guardian_id,
        channel,
      ),
    db
      .prepare(
        `insert into communication_recipients
           (id, communication_id, guardian_id, user_id, email, email_status, app_status)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        recipientId,
        communicationId,
        recipient.guardian_id,
        recipient.user_id,
        recipient.email,
        useEmail ? "pending" : "not_requested",
        useApp ? "available" : "not_requested",
      ),
  ]);

  let emailSent = 0;
  let emailFailed = 0;

  if (useEmail) {
    const delivery = await sendEmail(recipient.email, title, message, portalUrl);
    emailSent = delivery.status === "sent" ? 1 : 0;
    emailFailed = delivery.status === "failed" ? 1 : 0;

    await db.batch([
      db
        .prepare(
          `update communication_recipients
           set email_status = ?, provider_message_id = ?, email_error = ?,
               email_sent_at = case when ? = 'sent' then CURRENT_TIMESTAMP else null end
           where id = ?`,
        )
        .bind(
          delivery.status,
          delivery.providerId,
          delivery.error,
          delivery.status,
          recipientId,
        ),
      db
        .prepare(
          `update announcements
           set email_sent_count = ?, email_failed_count = ?, updated_at = CURRENT_TIMESTAMP
           where id = ?`,
        )
        .bind(emailSent, emailFailed, communicationId),
    ]);
  }

  return {
    skipped: false,
    emailSent,
    emailFailed,
    appCount: useApp ? 1 : 0,
  };
}

async function dashboardSummary() {
  return d1()
    .prepare(
      `select
         (select count(*) from students where status = 'active') as active_students,
         (select count(*) from applications where status in ('submitted','under_review','waitlisted')) as open_applications,
         (select coalesce(sum(amount_due_pence - amount_paid_pence), 0)
            from fee_invoices
           where status in ('pending','part_paid','overdue')) as outstanding_pence,
         (select count(*) from compliance
           where expires_at is not null
             and date(expires_at) <= date('now', '+30 day')) as compliance_due`,
    )
    .first<Record<string, unknown>>();
}

export async function GET(request: Request) {
  try {
    await actor(request, ["admin"]);
    const config = await settings();
    const fee = await feeCandidates(integer(config.fee_reminder_days_overdue, 7));
    const compliance = await complianceCandidates(integer(config.compliance_reminder_days, 30));
    const absences = await absenceCandidates(integer(config.absence_alert_threshold, 2));

    const recent = await d1()
      .prepare(
        `select action, details, created_at
         from audit_log
         where entity_type = 'automation'
         order by datetime(created_at) desc
         limit 10`,
      )
      .all<Record<string, unknown>>();

    return json({
      ok: true,
      settings: config,
      candidates: {
        fee,
        compliance,
        absences,
      },
      recentRuns: recent.results ?? [],
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const payload = await body(request);
    const action = text(payload.action);
    const config = await settings();
    const portalUrl = `${new URL(request.url).origin}/portal`;

    if (action === "run_fee_reminders") {
      if (!bool(config.fee_reminder_enabled)) {
        throw new ApiError(409, "Fee reminders are disabled in Automation settings.");
      }

      const candidates = await feeCandidates(integer(config.fee_reminder_days_overdue, 7));
      const groups = new Map<string, Candidate[]>();

      for (const row of candidates) {
        const key = text(row.guardian_id);
        if (!key) continue;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }

      let sent = 0;
      let skipped = 0;
      let emailFailed = 0;

      for (const rows of groups.values()) {
        const first = rows[0];
        const guardianId = text(first.guardian_id);
        const title = "Madrasah fee reminder";

        if (await recentlyMessaged(guardianId, title)) {
          skipped += 1;
          continue;
        }

        const lines = rows.map(
          (row) =>
            `${text(row.student_name)} (${text(row.student_number)}): ${money(row.balance_pence)} outstanding, due ${text(row.due_date)}.`,
        );
        const message = `This is a friendly reminder about outstanding Madrasah fees:\n\n${lines.join("\n")}\n\nPlease use the Fees & Payments area in the parent portal to review or pay the balance.`;

        const result = await sendParentMessage({
          authorId: who.id,
          recipient: {
            guardian_id: guardianId,
            user_id: text(first.user_id) || null,
            full_name: text(first.guardian_name) || "Parent / Guardian",
            email: text(first.guardian_email),
          },
          title,
          message,
          preferenceKey: "feeReminders",
          portalUrl,
        });

        if (result.skipped) skipped += 1;
        else sent += 1;
        emailFailed += result.emailFailed;
      }

      await audit(who, "run-fee-reminders", "automation", undefined, {
        sent,
        skipped,
        emailFailed,
        candidateCount: candidates.length,
      });

      return json({
        ok: true,
        message: `Fee reminder run completed. ${sent} parent${sent === 1 ? "" : "s"} notified${skipped ? `, ${skipped} skipped` : ""}.`,
        sent,
        skipped,
        emailFailed,
      });
    }

    if (action === "run_absence_alerts") {
      if (!bool(config.absence_alert_enabled)) {
        throw new ApiError(409, "Attendance alerts are disabled in Automation settings.");
      }

      const threshold = integer(config.absence_alert_threshold, 2);
      const candidates = await absenceCandidates(threshold);
      let sent = 0;
      let skipped = 0;
      let emailFailed = 0;

      for (const row of candidates) {
        const guardianId = text(row.guardian_id);
        const title = `Attendance concern – ${text(row.student_name)}`;

        if (!guardianId || (await recentlyMessaged(guardianId, title))) {
          skipped += 1;
          continue;
        }

        const message = `${text(row.student_name)} has been marked absent ${Number(row.absence_count ?? 0)} times within the last 30 days. The most recent absence was ${text(row.last_absence)}. Please contact the Madrasah if you would like to discuss attendance or if any record needs correcting.`;

        const result = await sendParentMessage({
          authorId: who.id,
          recipient: {
            guardian_id: guardianId,
            user_id: text(row.user_id) || null,
            full_name: text(row.guardian_name) || "Parent / Guardian",
            email: text(row.guardian_email),
          },
          title,
          message,
          preferenceKey: "attendanceAlerts",
          portalUrl,
        });

        if (result.skipped) skipped += 1;
        else sent += 1;
        emailFailed += result.emailFailed;
      }

      await audit(who, "run-attendance-alerts", "automation", undefined, {
        sent,
        skipped,
        emailFailed,
        threshold,
      });

      return json({
        ok: true,
        message: `Attendance alert run completed. ${sent} parent${sent === 1 ? "" : "s"} notified${skipped ? `, ${skipped} skipped` : ""}.`,
        sent,
        skipped,
        emailFailed,
      });
    }

    if (action === "run_compliance_reminders") {
      if (!bool(config.compliance_reminder_enabled)) {
        throw new ApiError(409, "Compliance reminders are disabled in Automation settings.");
      }

      const candidates = await complianceCandidates(integer(config.compliance_reminder_days, 30));
      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of candidates) {
        const email = text(row.email);
        const complianceId = text(row.id);
        if (!email || !complianceId) continue;

        if (await recentlyRemindedCompliance(complianceId)) {
          skipped += 1;
          continue;
        }

        const subject = `BNMC compliance reminder – ${text(row.check_type)}`;
        const message = `${text(row.display_name)}, your ${text(row.check_type)} record is due to expire on ${text(row.expires_at)}. Please provide the updated evidence to the Madrasah administrator before the expiry date.`;
        const result = await sendEmail(email, subject, message, portalUrl);

        if (result.status === "sent") {
          sent += 1;
          await audit(who, "automated-compliance-reminder", "compliance", complianceId, {
            email,
            expiresAt: text(row.expires_at),
            checkType: text(row.check_type),
          });
        } else {
          failed += 1;
        }
      }

      await audit(who, "run-compliance-reminders", "automation", undefined, {
        sent,
        skipped,
        failed,
        candidateCount: candidates.length,
      });

      return json({
        ok: true,
        message: `Compliance reminder run completed. ${sent} email${sent === 1 ? "" : "s"} sent${skipped ? `, ${skipped} skipped because a reminder was sent in the last 7 days` : ""}${failed ? `, ${failed} failed` : ""}.`,
        sent,
        skipped,
        failed,
      });
    }

    if (action === "send_management_report") {
      const recipient = text(config.scheduled_report_recipient);
      if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
        throw new ApiError(400, "Enter a valid scheduled report recipient in Automation settings first.");
      }

      const summary = (await dashboardSummary()) ?? {};
      const message = [
        `Active students: ${Number(summary.active_students ?? 0)}`,
        `Applications needing review: ${Number(summary.open_applications ?? 0)}`,
        `Outstanding fees: ${money(summary.outstanding_pence)}`,
        `Compliance records due within 30 days: ${Number(summary.compliance_due ?? 0)}`,
        "",
        "This summary was generated from the live BNMC Madrasah database.",
      ].join("\n");

      const delivery = await sendEmail(
        recipient,
        `BNMC management summary – ${new Date().toISOString().slice(0, 10)}`,
        message,
        portalUrl,
      );

      await audit(who, "send-management-report", "automation", undefined, {
        recipient,
        status: delivery.status,
      });

      if (delivery.status !== "sent") {
        throw new ApiError(502, delivery.error ?? "Unable to send management report.");
      }

      return json({ ok: true, message: `Management summary sent to ${recipient}.` });
    }

    throw new ApiError(400, "Unknown automation action.");
  } catch (error) {
    return fail(error);
  }
}
