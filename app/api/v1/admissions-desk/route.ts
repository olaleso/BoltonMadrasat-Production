import { d1 } from "@/db";

import {
  actor,
  body,
  fail,
  json,
  optional,
  required,
  ApiError,
} from "@/lib/backend";
import { provisionParentAccess } from "@/lib/parent-access";

type Row =
  Record<
    string,
    unknown
  >;

async function all<T = Row>(
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

async function first<T = Row>(
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

function dateValue(
  value: unknown,
  label: string,
) {

  const result =
    required(
      value,
      label,
    );

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(
        result,
      )
  ) {

    throw new ApiError(
      400,
      `${label} must be in YYYY-MM-DD format`,
    );
  }

  return result;
}

function genderValue(
  value: unknown,
) {

  const gender =
    String(
      value ??
      "",
    )
    .trim()
    .toLowerCase();

  if (
    gender ===
    "male"
  ) {
    return "Male";
  }

  if (
    gender ===
    "female"
  ) {
    return "Female";
  }

  throw new ApiError(
    409,
    "Student gender must be Male or Female before enrolment can be completed.",
  );
}

function categoryValue(
  value: unknown,
) {

  const category =
    required(
      value,
      "Category",
    );

  if (
    ![
      "1",
      "2",
      "3",
    ].includes(
      category,
    )
  ) {

    throw new ApiError(
      400,
      "Category must be 1, 2 or 3",
    );
  }

  return category;
}

export async function GET(
  request: Request,
) {

  try {

    await actor(
      request,
      [
        "admin",
      ],
    );

    const applications =
      await all(
        `select
           a.id
             as application_id,

           a.status,

           a.preferred_session,

           a.prior_level,

           a.submitted_at,

           a.created_at,

           a.review_notes,

           a.payment_status,

           s.id
             as student_id,

           s.student_number,

           s.first_name,

           s.last_name,

           s.first_name ||
           ' ' ||
           s.last_name
             as student_name,

           s.date_of_birth,

           s.gender,

           s.ethnic_group,

           s.medical_notes,

           s.allergy_notes,

           s.additional_needs,

           g.full_name
             as guardian_name,

           g.email
             as guardian_email,

           g.phone
             as guardian_phone,

           g.relationship,

           g.postcode,

           g.emergency_contact_number,

           c.name
             as class_name

         from applications a

         join students s
           on s.id =
              a.student_id

         left join student_guardians sg
           on sg.student_id =
                s.id
          and sg.is_primary =
                1

         left join guardians g
           on g.id =
                sg.guardian_id

         left join enrolments e
           on e.student_id =
                s.id
          and e.status =
                'active'

         left join classes c
           on c.id =
                e.class_id

         order by

           case a.status

             when 'submitted'
               then 0

             when 'under_review'
               then 1

             when 'waitlisted'
               then 2

             when 'payment_pending'
               then 3

             when 'accepted'
               then 4

             else 5

           end,

           coalesce(
             a.submitted_at,
             a.created_at
           ) desc`,
      );

    const classes =
      await all(
        `select
           c.id,

           c.name,

           c.level,

           c.capacity,

           c.start_time,

           c.end_time,

           (
             select count(*)

             from enrolments e

             where
               e.class_id =
                 c.id
               and e.status =
                 'active'
           )
             as enrolled

         from classes c

         where
           c.status =
             'active'

           and c.name in (
             'Category 1 (Male)',
             'Category 1 (Female)',
             'Category 2 (Male)',
             'Category 2 (Female)',
             'Category 3 (Male)',
             'Category 3 (Female)'
           )

         order by
           c.name`,
      );

    const feePlans =
      await all(
        `select
           id,
           name,
           amount_pence,
           currency

         from fee_plans

         where
           active = 1
           and frequency =
             'monthly'

         order by name`,
      );

    return json({
      ok: true,
      applications,
      classes,
      feePlans,
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
        [
          "admin",
        ],
      );

    const x =
      await body(
        request,
      );

    const action =
      required(
        x.action,
        "Action",
      );

    if (
      action !==
      "accept-enrol"
    ) {

      throw new ApiError(
        400,
        "Unknown admissions action",
      );
    }

    const applicationId =
      required(
        x.applicationId,
        "Application",
      );

    const category =
      categoryValue(
        x.category,
      );

    const startsOn =
      dateValue(
        x.startsOn,
        "Start date",
      );

    const reviewNotes =
      optional(
        x.reviewNotes,
      );

    const application =
      await first<{
        application_id:
          string;

        status:
          string;

        student_id:
          string;

        first_name:
          string;

        last_name:
          string;

        gender:
          string;

        payment_status:
          string;
      }>(
        `select
           a.id
             as application_id,

           a.status,

           a.student_id,

           a.payment_status,

           s.first_name,

           s.last_name,

           s.gender

         from applications a

         join students s
           on s.id =
                a.student_id

         where
           a.id = ?

         limit 1`,
        applicationId,
      );

    if (
      !application
    ) {

      throw new ApiError(
        404,
        "Application not found",
      );
    }

    if (
      application.status ===
      "payment_pending"
    ) {

      throw new ApiError(
        409,
        "Application payment must be completed before admission.",
      );
    }

    if (
      ![
        "submitted",
        "under_review",
        "waitlisted",
        "accepted",
      ].includes(
        application.status,
      )
    ) {

      throw new ApiError(
        409,
        `This application cannot be admitted from status ${application.status}.`,
      );
    }

    const gender =
      genderValue(
        application.gender,
      );

    const className =
      `Category ${category} (${gender})`;

    const classRow =
      await first<{
        id: string;
        name: string;
        capacity: number;
        enrolled: number;
      }>(
        `select
           c.id,

           c.name,

           c.capacity,

           (
             select count(*)

             from enrolments e

             where
               e.class_id =
                 c.id
               and e.status =
                 'active'
           )
             as enrolled

         from classes c

         where
           c.name = ?
           and c.status =
               'active'

         limit 1`,
        className,
      );

    if (
      !classRow
    ) {

      throw new ApiError(
        409,
        `${className} has not been created yet.`,
      );
    }

    const capacity =
      Number(
        classRow.capacity,
      );

    const enrolled =
      Number(
        classRow.enrolled ??
        0,
      );

    if (
      enrolled >=
      capacity
    ) {

      throw new ApiError(
        409,
        `${className} is already full.`,
      );
    }

    const otherEnrolment =
      await first<{
        class_name:
          string;
      }>(
        `select
           c.name
             as class_name

         from enrolments e

         join classes c
           on c.id =
                e.class_id

         where
           e.student_id = ?
           and e.status =
               'active'
           and e.class_id <> ?

         limit 1`,
        application.student_id,
        classRow.id,
      );

    if (
      otherEnrolment
    ) {

      throw new ApiError(
        409,
        `${application.first_name} is already enrolled in ${otherEnrolment.class_name}.`,
      );
    }

    const feePlan =
      await first<{
        id: string;
        name: string;
        amount_pence: number;
      }>(
        `select id, name, amount_pence
         from fee_plans
         where
           active = 1
           and frequency = 'monthly'
         order by
           case when id = 'standard-monthly-30' then 0 else 1 end,
           created_at
         limit 1`,
      );

    if (!feePlan) {
      throw new ApiError(
        409,
        "The standard £30 monthly fee has not been configured.",
      );
    }

    const existingFee =
      await first<{
            id: string;
          }>(
            `select id

             from student_fee_agreements

             where
               student_id = ?
               and status =
                   'active'

             limit 1`,
            application.student_id,
          );

    const feeAgreementId =
      existingFee?.id ??
      crypto.randomUUID();

    const db =
      d1();

    const statements = [

      db.prepare(
        `update applications

         set
           status =
             'accepted',

           reviewed_by = ?,

           review_notes =
             coalesce(
               ?,
               review_notes
             ),

           updated_at =
             CURRENT_TIMESTAMP

         where id = ?`,
      )
      .bind(
        who.id,
        reviewNotes,
        applicationId,
      ),

      db.prepare(
        `update students

         set
           status =
             'active',

           updated_at =
             CURRENT_TIMESTAMP

         where id = ?`,
      )
      .bind(
        application.student_id,
      ),

      db.prepare(
        `insert into enrolments
           (
             id,
             student_id,
             class_id,
             enrolled_at,
             status
           )

         values (
           ?, ?, ?, ?,
           'active'
         )

         on conflict (
           student_id,
           class_id
         )

         do update set
           status =
             'active',

           enrolled_at =
             excluded.enrolled_at,

           updated_at =
             CURRENT_TIMESTAMP`,
      )
      .bind(
        crypto.randomUUID(),
        application.student_id,
        classRow.id,
        startsOn,
      ),
    ];

    if (
      !existingFee
    ) {

      statements.push(

        db.prepare(
          `insert into student_fee_agreements
             (
               id,
               student_id,
               fee_plan_id,
               monthly_amount_pence,
               discount_pence,
               billing_day,
               starts_on,
               ends_on,
               collection_method,
               status
             )

           values (
             ?, ?, ?, ?,
             0,
             1,
             ?,
             null,
             'online',
             'active'
           )`,
        )
        .bind(
          feeAgreementId,
          application.student_id,
          feePlan.id,
          3000,
          startsOn,
        ),
      );
    }

    const billingYear =
      Number(
        startsOn.slice(0, 4),
      );
    const billingMonth =
      Number(
        startsOn.slice(5, 7),
      );

    statements.push(
      db.prepare(
        `insert or ignore into fee_invoices
           (
             id,
             student_id,
             agreement_id,
             billing_year,
             billing_month,
             description,
             amount_pence,
             discount_pence,
             amount_due_pence,
             amount_paid_pence,
             due_date,
             status
           )
         values (
           ?, ?, ?, ?, ?, ?,
           3000, 0, 3000, 0, ?,
           'pending'
         )`,
      )
      .bind(
        crypto.randomUUID(),
        application.student_id,
        feeAgreementId,
        billingYear,
        billingMonth,
        `${feePlan.name} - ${new Intl.DateTimeFormat(
          "en-GB",
          {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          },
        ).format(new Date(`${startsOn}T00:00:00Z`))}`,
        startsOn,
      ),
    );

    statements.push(

      db.prepare(
        `insert into audit_log
           (
             id,
             user_id,
             action,
             entity_type,
             entity_id,
             details
           )

         values (
           ?, ?,
           'accept-and-enrol',
           'applications',
           ?, ?
         )`,
      )
      .bind(
        crypto.randomUUID(),
        who.id,
        applicationId,

        JSON.stringify({
          studentId:
            application.student_id,

          className:
            classRow.name,

          startsOn,

          feePlan:
            feePlan?.name ??
            null,
        }),
      ),
    );

    await db.batch(
      statements,
    );

    const parentAccess =
      await provisionParentAccess(
        applicationId,
        new URL(request.url).origin,
      );

    return json({
      ok: true,

      applicationId,

      studentId:
        application.student_id,

      studentName:
        `${application.first_name} ${application.last_name}`,

      className:
        classRow.name,

      feeConfigured:
        Boolean(
          feePlan ||
          existingFee,
        ),

      parentAccess,
    });

  }
  catch (error) {

    return fail(
      error,
    );
  }
}



