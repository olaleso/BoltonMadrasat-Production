import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

const academicDefaults: Record<string, string> = {
  academic_year_label: "2026/2027",
  term_name: "Autumn Term",
  term_start_date: "2026-09-05",
  term_end_date: "2026-12-20",
  programme_start_date: "2026-09-05",
  assessment_dates_text: "19th and 26th July 2026",
  open_day_text: "Sunday 30th August",
  standard_session_start: "09:30",
  standard_session_end: "11:30",
  holiday_notes: "",
};

const automationDefaults: Record<string, string> = {
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

const homepageDefaults: Record<string, string> = {
  homepage_announcement_enabled: "true",
  homepage_announcement_text:
    "Bismillah — begin your child's BNMC Madrasah journey",
  homepage_announcement_cta_label: "Apply now",
  homepage_announcement_cta_url: "/apply",
  homepage_testimonial_quote:
    "A warm and nurturing environment where children can grow in knowledge, faith and character.",
  homepage_testimonial_author: "BNMC Parent",
  homepage_hero_media_ids: "[]",
};

const notificationDefaults = {
  appMessages: true,
  emailMessages: true,
  feeReminders: true,
  attendanceAlerts: true,
  weeklySummary: false,
};

const academicKeys = new Set(Object.keys(academicDefaults));
const automationKeys = new Set(Object.keys(automationDefaults));
const homepageKeys = new Set(Object.keys(homepageDefaults));

async function readSettings() {
  const result = await d1()
    .prepare(
      `select key, value
       from app_settings
       where key in (${[...academicKeys, ...automationKeys, ...homepageKeys]
         .map(() => "?")
         .join(",")})`,
    )
    .bind(...academicKeys, ...automationKeys, ...homepageKeys)
    .all<{ key: string; value: string }>();

  const settings = {
    ...academicDefaults,
    ...automationDefaults,
    ...homepageDefaults,
  };

  for (const row of result.results ?? []) {
    settings[row.key] = String(row.value ?? "");
  }

  return settings;
}

async function readPreferences(userId: string) {
  const row = await d1()
    .prepare("select value from app_settings where key = ? limit 1")
    .bind(`notification_preferences:${userId}`)
    .first<{ value: string }>();

  if (!row?.value) return notificationDefaults;

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
    return notificationDefaults;
  }
}

function cleanSettings(
  input: unknown,
  allowed: Set<string>,
) {
  if (!input || typeof input !== "object") {
    throw new ApiError(400, "Settings are required.");
  }

  const output: Record<string, string> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    output[key] = String(value ?? "").trim();
  }

  return output;
}

function validateAcademicSettings(values: Record<string, string>) {
  const required = [
    "academic_year_label",
    "term_name",
    "term_start_date",
    "term_end_date",
    "programme_start_date",
    "assessment_dates_text",
    "open_day_text",
    "standard_session_start",
    "standard_session_end",
  ];

  for (const key of required) {
    if (!String(values[key] ?? "").trim()) {
      throw new ApiError(400, "Please complete all required academic calendar fields.");
    }
  }

  for (const key of ["term_start_date", "term_end_date", "programme_start_date"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values[key] ?? "")) {
      throw new ApiError(400, "Academic dates must use a valid YYYY-MM-DD value.");
    }
  }

  for (const key of ["standard_session_start", "standard_session_end"]) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values[key] ?? "")) {
      throw new ApiError(400, "Standard session times must use a valid 24-hour time.");
    }
  }

  if (values.term_end_date < values.term_start_date) {
    throw new ApiError(400, "Term end date cannot be before the term start date.");
  }
}

function validateAutomationSettings(values: Record<string, string>) {
  const within = (key: string, min: number, max: number) => {
    const value = Number(values[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new ApiError(400, `${key.replaceAll("_", " ")} must be between ${min} and ${max}.`);
    }
  };

  within("fee_reminder_days_overdue", 1, 365);
  within("compliance_reminder_days", 1, 365);
  within("absence_alert_threshold", 1, 30);

  if (!["weekly", "monthly"].includes(values.scheduled_report_cadence ?? "")) {
    throw new ApiError(400, "Scheduled report cadence must be weekly or monthly.");
  }

  const days = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
  ];
  if (!days.includes(values.scheduled_report_day ?? "")) {
    throw new ApiError(400, "Choose a valid scheduled report delivery day.");
  }

  const recipient = String(values.scheduled_report_recipient ?? "").trim();
  if (recipient && !/^\S+@\S+\.\S+$/.test(recipient)) {
    throw new ApiError(400, "Enter a valid management report recipient email address.");
  }
}

function validateHomepageSettings(
  values: Record<string, string>,
) {
  const withinLength = (
    key: string,
    label: string,
    max: number,
  ) => {
    const value =
      String(
        values[key] ??
          "",
      ).trim();

    if (value.length > max) {
      throw new ApiError(
        400,
        `${label} must be ${max} characters or fewer.`,
      );
    }
  };

  withinLength(
    "homepage_announcement_text",
    "Announcement",
    180,
  );

  withinLength(
    "homepage_announcement_cta_label",
    "Announcement button label",
    40,
  );

  withinLength(
    "homepage_announcement_cta_url",
    "Announcement button URL",
    300,
  );

  withinLength(
    "homepage_testimonial_quote",
    "Testimonial",
    500,
  );

  withinLength(
    "homepage_testimonial_author",
    "Testimonial author",
    100,
  );

  if (
    ![
      "true",
      "false",
    ].includes(
      values.homepage_announcement_enabled ??
        "",
    )
  ) {
    throw new ApiError(
      400,
      "Announcement visibility must be true or false.",
    );
  }

  const ctaUrl =
    String(
      values.homepage_announcement_cta_url ??
        "",
    ).trim();

  if (
    ctaUrl &&
    !(
      ctaUrl.startsWith("/") ||
      /^https?:\/\//i.test(
        ctaUrl,
      )
    )
  ) {
    throw new ApiError(
      400,
      "Announcement button URL must start with / or http:// / https://.",
    );
  }

  try {
    const parsed =
      JSON.parse(
        values.homepage_hero_media_ids ??
          "[]",
      );

    if (
      !Array.isArray(
        parsed,
      ) ||
      parsed.length >
        6 ||
      parsed.some(
        (value) =>
          typeof value !==
          "string",
      )
    ) {
      throw new Error(
        "invalid",
      );
    }
  }
  catch {
    throw new ApiError(
      400,
      "Hero image selection is invalid.",
    );
  }
}

async function upsertSettings(values: Record<string, string>) {
  const db = d1();
  const statements = Object.entries(values).map(([key, value]) =>
    db
      .prepare(
        `insert into app_settings (key, value)
         values (?, ?)
         on conflict(key) do update set
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, value),
  );

  if (statements.length) {
    await db.batch(statements);
  }
}

export async function GET(request: Request) {
  try {
    const who = await actor(request, [
      "admin",
      "teacher",
      "finance",
      "safeguarding",
      "parent",
    ]);

    const [settings, preferences] = await Promise.all([
      readSettings(),
      readPreferences(who.id),
    ]);

    return json({
      ok: true,
      settings,
      preferences,
      canEditGlobal: who.role === "admin",
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const who = await actor(request, [
      "admin",
      "teacher",
      "finance",
      "safeguarding",
      "parent",
    ]);
    const payload = await body(request);
    const scope = String(payload.scope ?? "").trim();

    if (scope === "notifications") {
      const value = {
        appMessages: payload.appMessages !== false,
        emailMessages: payload.emailMessages !== false,
        feeReminders: payload.feeReminders !== false,
        attendanceAlerts: payload.attendanceAlerts !== false,
        weeklySummary: payload.weeklySummary === true,
      };

      await upsertSettings({
        [`notification_preferences:${who.id}`]: JSON.stringify(value),
      });

      await audit(
        who,
        "update-notification-preferences",
        "users",
        who.id,
        value,
      );

      return json({ ok: true, preferences: value });
    }

    if (who.role !== "admin") {
      throw new ApiError(403, "Only administrators can change Madrasah-wide settings.");
    }

    if (scope === "academic") {
      const current = await readSettings();
      const values = {
        ...Object.fromEntries(Object.entries(current).filter(([key]) => academicKeys.has(key))),
        ...cleanSettings(payload.settings, academicKeys),
      };
      validateAcademicSettings(values);
      await upsertSettings(values);
      await audit(who, "update-academic-settings", "app_settings", undefined, values);
      return json({ ok: true, settings: await readSettings() });
    }

    if (scope === "automation") {
      const current = await readSettings();
      const values = {
        ...Object.fromEntries(Object.entries(current).filter(([key]) => automationKeys.has(key))),
        ...cleanSettings(payload.settings, automationKeys),
      };
      validateAutomationSettings(values);
      await upsertSettings(values);
      await audit(who, "update-automation-settings", "app_settings", undefined, values);
      return json({ ok: true, settings: await readSettings() });
    }

    if (scope === "homepage") {
      const current = await readSettings();
      const values = {
        ...Object.fromEntries(
          Object.entries(current).filter(
            ([key]) =>
              homepageKeys.has(key),
          ),
        ),
        ...cleanSettings(
          payload.settings,
          homepageKeys,
        ),
      };

      validateHomepageSettings(
        values,
      );

      await upsertSettings(
        values,
      );

      await audit(
        who,
        "update-homepage-settings",
        "app_settings",
        undefined,
        {
          announcementEnabled:
            values.homepage_announcement_enabled,
          heroMediaCount:
            JSON.parse(
              values.homepage_hero_media_ids ||
                "[]",
            ).length,
          testimonialAuthor:
            values.homepage_testimonial_author,
        },
      );

      return json({
        ok: true,
        settings:
          await readSettings(),
      });
    }

    throw new ApiError(400, "Unknown settings scope.");
  } catch (error) {
    return fail(error);
  }
}
