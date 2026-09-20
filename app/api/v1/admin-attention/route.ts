import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
} from "@/lib/backend";

type CountRow = {
  total: number;
};

type MoneyRow = {
  total: number;
};

type ActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  actor: string | null;
  created_at: string;
};

async function first<T>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement =
    d1().prepare(
      query,
    );

  return bindings.length
    ? await statement
        .bind(
          ...bindings,
        )
        .first<T>()
    : await statement
        .first<T>();
}

async function all<T>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement =
    d1().prepare(
      query,
    );

  const result =
    bindings.length
      ? await statement
          .bind(
            ...bindings,
          )
          .all<T>()
      : await statement
          .all<T>();

  return result.results;
}

function labelForActivity(
  action: string,
  entityType: string,
) {
  const normalized =
    action
      .replaceAll(
        "-",
        " ",
      )
      .replaceAll(
        "_",
        " ",
      )
      .trim();

  const entity =
    entityType
      .replaceAll(
        "_",
        " ",
      )
      .trim();

  if (
    action ===
    "guardian-bulk-update"
  ) {
    return "Guardian details updated";
  }

  if (
    action ===
    "application-status-transition"
  ) {
    return "Admission status updated";
  }

  if (
    action ===
    "create-enrolment"
  ) {
    return "Student enrolled";
  }

  if (
    action ===
    "transfer-enrolment"
  ) {
    return "Student transferred";
  }

  if (
    action ===
    "create-attendance" ||
    action ===
    "update-attendance"
  ) {
    return "Attendance updated";
  }

  if (
    action ===
    "create-progress"
  ) {
    return "Student progress recorded";
  }

  if (
    action ===
    "update-profile" &&
    entityType ===
    "staff"
  ) {
    return "Staff profile updated";
  }

  if (
    action ===
    "update-status" &&
    entityType ===
    "staff"
  ) {
    return "Staff status updated";
  }

  if (
    action ===
    "permanent-delete"
  ) {
    return `${entity || "Record"} permanently deleted`;
  }

  if (
    normalized
  ) {
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }

  return entity
    ? `${entity.charAt(0).toUpperCase()}${entity.slice(1)} updated`
    : "Activity recorded";
}

function friendlyWhen(
  value: string,
) {
  const parsed =
    new Date(
      value.endsWith("Z")
        ? value
        : `${value.replace(
            " ",
            "T",
          )}Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "2-digit",
      month:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
      timeZone:
        "Europe/London",
    },
  ).format(
    parsed,
  );
}

export async function GET(
  request: Request,
) {
  try {
    await actor(
      request,
      ["admin"],
    );

    const [
      applications,
      missingGuardians,
      withoutClass,
      withoutTeacher,
      overdueInvoices,
      overdueBalance,
      complianceDue,
      failedTrackedEmails,
      failedCommunicationEmails,
      activity,
    ] =
      await Promise.all([
        first<CountRow>(
          `select
             count(*) as total
           from applications
           where status in (
             'submitted',
             'under_review',
             'waitlisted'
           )`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from students s
           where
             s.status = 'active'
             and not exists (
               select 1
               from student_guardians sg
               where
                 sg.student_id =
                   s.id
             )`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from students s
           where
             s.status = 'active'
             and not exists (
               select 1
               from enrolments e
               where
                 e.student_id =
                   s.id
                 and e.status =
                   'active'
             )`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from classes c
           where
             c.status = 'active'
             and (
               c.teacher_id is null
               or trim(
                 c.teacher_id
               ) = ''
             )`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from fee_invoices
           where
             due_date <
               date('now')
             and status not in (
               'paid',
               'cancelled',
               'void'
             )
             and coalesce(
               amount_due_pence,
               0
             ) >
             coalesce(
               amount_paid_pence,
               0
             )`,
        ),

        first<MoneyRow>(
          `select
             coalesce(
               sum(
                 max(
                   coalesce(
                     amount_due_pence,
                     0
                   ) -
                   coalesce(
                     amount_paid_pence,
                     0
                   ),
                   0
                 )
               ),
               0
             ) as total
           from fee_invoices
           where
             due_date <
               date('now')
             and status not in (
               'paid',
               'cancelled',
               'void'
             )`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from compliance
           where
             expires_at is not null
             and date(
               expires_at
             ) <=
               date(
                 'now',
                 '+30 day'
               )
             and status !=
               'expired'`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from email_delivery_log
           where status = 'failed'`,
        ),

        first<CountRow>(
          `select
             count(*) as total
           from communication_recipients
           where email_status = 'failed'`,
        ),

        all<ActivityRow>(
          `select
             a.id,
             a.action,
             a.entity_type,
             coalesce(
               u.display_name,
               'System'
             ) as actor,
             a.created_at
           from audit_log a
           left join users u
             on u.id =
                a.user_id
           order by
             a.created_at desc
           limit 8`,
        ),
      ]);

    return json({
      ok: true,
      data: {
        applicationsAwaitingReview:
          Number(
            applications
              ?.total ??
              0,
          ),

        studentsMissingGuardians:
          Number(
            missingGuardians
              ?.total ??
              0,
          ),

        studentsWithoutClass:
          Number(
            withoutClass
              ?.total ??
              0,
          ),

        classesWithoutTeacher:
          Number(
            withoutTeacher
              ?.total ??
              0,
          ),

        overdueInvoices:
          Number(
            overdueInvoices
              ?.total ??
              0,
          ),

        overdueBalancePence:
          Number(
            overdueBalance
              ?.total ??
              0,
          ),

        complianceDueSoon:
          Number(
            complianceDue
              ?.total ??
              0,
          ),

        failedEmails:
          Number(
            failedTrackedEmails
              ?.total ??
              0,
          ) +
          Number(
            failedCommunicationEmails
              ?.total ??
              0,
          ),

        recentActivity:
          activity.map(
            (row) => ({
              id:
                row.id,
              label:
                labelForActivity(
                  row.action,
                  row.entity_type,
                ),
              actor:
                row.actor ??
                "System",
              when:
                friendlyWhen(
                  row.created_at,
                ),
            }),
          ),
      },
    });
  }
  catch (error) {
    return fail(
      error,
    );
  }
}
