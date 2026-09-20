import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  integer,
  json,
  optional,
  required,
  ApiError,
} from "@/lib/backend";

type Row = Record<string, unknown>;

async function all<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = d1().prepare(query);

  const result = bindings.length
    ? await statement.bind(...bindings).all<T>()
    : await statement.all<T>();

  return result.results;
}

async function first<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);

  return bindings.length
    ? await statement.bind(...bindings).first<T>()
    : await statement.first<T>();
}

function requireDate(
  value: unknown,
  label: string,
) {
  const result = required(
    value,
    label,
  );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
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

function validDate(
  value: string,
) {
  const date = new Date(
    `${value}T00:00:00Z`,
  );

  return (
    !Number.isNaN(
      date.getTime(),
    ) &&
    date
      .toISOString()
      .slice(0, 10) === value
  );
}

function monthName(
  year: number,
  month: number,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        1,
      ),
    ),
  );
}

export async function GET(
  request: Request,
) {
  try {
    const who =
      await actor(
        request,
      );

    const url =
      new URL(
        request.url,
      );

    const section =
      url.searchParams.get(
        "section",
      ) ?? "invoices";

    /*
     * FEE PLANS
     */
    if (
      section ===
      "plans"
    ) {
      if (
        ![
          "admin",
          "finance",
        ].includes(
          who.role,
        )
      ) {
        throw new ApiError(
          403,
          "You do not have permission to view fee plans",
        );
      }

      const data =
        await all(
          `select
             fp.*,

             (
               select count(*)
               from student_fee_agreements sfa
               where
                 sfa.fee_plan_id = fp.id
                 and sfa.status = 'active'
             ) as active_agreements

           from fee_plans fp

           order by
             fp.active desc,
             fp.name`,
        );

      return json({
        ok: true,
        section,
        data,
      });
    }

    /*
     * STUDENT FEE AGREEMENTS
     */
    if (
      section ===
      "agreements"
    ) {
      if (
        who.role ===
        "parent"
      ) {
        const data =
          await all(
            `select
               sfa.*,

               s.student_number,

               s.first_name || ' ' ||
               s.last_name
                 as student_name,

               fp.name
                 as fee_plan_name,

               fp.frequency,

               fp.currency

             from student_fee_agreements sfa

             join students s
               on s.id =
                  sfa.student_id

             left join fee_plans fp
               on fp.id =
                  sfa.fee_plan_id

             where exists (
               select 1

               from student_guardians sg

               join guardians g
                 on g.id =
                    sg.guardian_id

               where
                 sg.student_id =
                   sfa.student_id

                 and g.user_id = ?
             )

             order by
               case
                 when sfa.status = 'active'
                 then 0
                 else 1
               end,

               s.last_name,
               s.first_name`,
            who.id,
          );

        return json({
          ok: true,
          section,
          data,
        });
      }

      if (
        ![
          "admin",
          "finance",
        ].includes(
          who.role,
        )
      ) {
        throw new ApiError(
          403,
          "You do not have permission to view fee agreements",
        );
      }

      const data =
        await all(
          `select
             sfa.*,

             s.student_number,

             s.first_name || ' ' ||
             s.last_name
               as student_name,

             fp.name
               as fee_plan_name,

             fp.frequency,

             fp.currency

           from student_fee_agreements sfa

           join students s
             on s.id =
                sfa.student_id

           left join fee_plans fp
             on fp.id =
                sfa.fee_plan_id

           order by
             case
               when sfa.status = 'active'
               then 0
               else 1
             end,

             s.last_name,
             s.first_name`,
        );

      return json({
        ok: true,
        section,
        data,
      });
    }

    /*
     * INVOICES
     */
    if (
      section ===
      "invoices"
    ) {
      if (
        who.role ===
        "parent"
      ) {
        const data =
          await all(
            `select
               fi.*,

               s.student_number,

               s.first_name || ' ' ||
               s.last_name
                 as student_name,

               fp.name
                 as fee_plan_name,

               (
                 fi.amount_due_pence -
                 fi.amount_paid_pence
               ) as balance_pence

             from fee_invoices fi

             join students s
               on s.id =
                  fi.student_id

             join student_guardians sg
               on sg.student_id =
                  s.id

             join guardians g
               on g.id =
                  sg.guardian_id

             left join student_fee_agreements sfa
               on sfa.id =
                  fi.agreement_id

             left join fee_plans fp
               on fp.id =
                  sfa.fee_plan_id

             where
               g.user_id = ?

             order by
               fi.due_date desc,
               fi.created_at desc`,
            who.id,
          );

        return json({
          ok: true,
          section,
          data,
        });
      }

      if (
        ![
          "admin",
          "finance",
        ].includes(
          who.role,
        )
      ) {
        throw new ApiError(
          403,
          "You do not have permission to view invoices",
        );
      }

      const data =
        await all(
          `select
             fi.*,

             s.student_number,

             s.first_name || ' ' ||
             s.last_name
               as student_name,

             fp.name
               as fee_plan_name,

             (
               fi.amount_due_pence -
               fi.amount_paid_pence
             ) as balance_pence

           from fee_invoices fi

           join students s
             on s.id =
                fi.student_id

           left join student_fee_agreements sfa
             on sfa.id =
                fi.agreement_id

           left join fee_plans fp
             on fp.id =
                sfa.fee_plan_id

           order by
             case
               when fi.status in (
                 'pending',
                 'collection_pending',
                 'part_paid',
                 'overdue'
               )
               then 0
               else 1
             end,

             fi.due_date,
             s.last_name,
             s.first_name`,
        );

      return json({
        ok: true,
        section,
        data,
      });
    }

    throw new ApiError(
      400,
      "Unknown billing section",
    );
  } catch (error) {
    return fail(error);
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
          "finance",
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

    /*
     * CREATE FEE PLAN
     */
    if (
      action ===
      "create-plan"
    ) {
      const name =
        required(
          x.name,
          "Plan name",
        );

      const frequency =
        (
          optional(
            x.frequency,
          ) ??
          "monthly"
        )
          .toLowerCase()
          .trim();

      const allowedFrequencies = [
        "monthly",
        "termly",
        "annual",
        "one_off",
      ];

      if (
        !allowedFrequencies.includes(
          frequency,
        )
      ) {
        throw new ApiError(
          400,
          `Frequency must be one of: ${allowedFrequencies.join(", ")}`,
        );
      }

      const amountPence =
        integer(
          x.amountPence,
          "Amount",
          1,
        );

      const currency =
        (
          optional(
            x.currency,
          ) ??
          "GBP"
        )
          .toUpperCase()
          .trim();

      if (
        currency !==
        "GBP"
      ) {
        throw new ApiError(
          400,
          "Version 1 currently supports GBP fee plans only",
        );
      }

      const duplicate =
        await first<{
          id: string;
        }>(
          `select id
           from fee_plans
           where
             lower(name) =
             lower(?)
             and active = 1
           limit 1`,
          name,
        );

      if (duplicate) {
        throw new ApiError(
          409,
          "An active fee plan with this name already exists",
        );
      }

      const id =
        crypto.randomUUID();

      const row =
        await first(
          `insert into fee_plans
             (
               id,
               name,
               frequency,
               amount_pence,
               currency,
               active
             )

           values (
             ?, ?, ?, ?, ?, 1
           )

           returning *`,
          id,
          name,
          frequency,
          amountPence,
          currency,
        );

      if (!row) {
        throw new ApiError(
          500,
          "Fee plan could not be created",
        );
      }

      await audit(
        who,
        "create-fee-plan",
        "fee_plans",
        id,
        {
          name,
          frequency,
          amountPence,
          currency,
        },
      );

      return json(
        {
          ok: true,
          data: row,
        },
        201,
      );
    }

    /*
     * CREATE STUDENT FEE AGREEMENT
     */
    if (
      action ===
      "create-agreement"
    ) {
      const studentId =
        required(
          x.studentId,
          "Student",
        );

      const feePlanId =
        required(
          x.feePlanId,
          "Fee plan",
        );

      const student =
        await first<{
          id: string;
          first_name: string;
          last_name: string;
          status: string;
        }>(
          `select
             id,
             first_name,
             last_name,
             status

           from students

           where id = ?

           limit 1`,
          studentId,
        );

      if (!student) {
        throw new ApiError(
          404,
          "Student not found",
        );
      }

      if (
        student.status !==
        "active"
      ) {
        throw new ApiError(
          409,
          "Only active students can have an active fee agreement",
        );
      }

      const plan =
        await first<{
          id: string;
          name: string;
          frequency: string;
          amount_pence: number;
          active: number;
        }>(
          `select
             id,
             name,
             frequency,
             amount_pence,
             active

           from fee_plans

           where id = ?

           limit 1`,
          feePlanId,
        );

      if (!plan) {
        throw new ApiError(
          404,
          "Fee plan not found",
        );
      }

      if (
        Number(
          plan.active,
        ) !== 1
      ) {
        throw new ApiError(
          409,
          "This fee plan is not active",
        );
      }

      /*
       * Current agreement model is monthly.
       * Termly/annual/one-off plans can still
       * exist, but they are not assigned through
       * the recurring monthly agreement flow.
       */
      if (
        plan.frequency !==
        "monthly"
      ) {
        throw new ApiError(
          409,
          "Only monthly fee plans can currently be assigned to recurring student agreements",
        );
      }

      const monthlyAmountPence =
        x.monthlyAmountPence ===
          undefined ||
        x.monthlyAmountPence ===
          null ||
        String(
          x.monthlyAmountPence,
        ).trim() === ""
          ? Number(
              plan.amount_pence,
            )
          : integer(
              x.monthlyAmountPence,
              "Monthly amount",
              1,
            );

      const discountPence =
        x.discountPence ===
          undefined ||
        x.discountPence ===
          null ||
        String(
          x.discountPence,
        ).trim() === ""
          ? 0
          : integer(
              x.discountPence,
              "Discount",
              0,
            );

      if (
        discountPence >
        monthlyAmountPence
      ) {
        throw new ApiError(
          400,
          "Discount cannot be greater than the monthly fee",
        );
      }

      const billingDay =
        integer(
          x.billingDay ?? 1,
          "Billing day",
          1,
        );

      /*
       * Restrict to 1-28 so every month
       * always has the requested date.
       */
      if (
        billingDay > 28
      ) {
        throw new ApiError(
          400,
          "Billing day must be between 1 and 28",
        );
      }

      const startsOn =
        requireDate(
          x.startsOn,
          "Start date",
        );

      if (
        !validDate(
          startsOn,
        )
      ) {
        throw new ApiError(
          400,
          "Start date is not a valid calendar date",
        );
      }

      const endsOn =
        optional(
          x.endsOn,
        );

      if (
        endsOn
      ) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            endsOn,
          ) ||
          !validDate(
            endsOn,
          )
        ) {
          throw new ApiError(
            400,
            "End date must be a valid date in YYYY-MM-DD format",
          );
        }

        if (
          endsOn <
          startsOn
        ) {
          throw new ApiError(
            400,
            "End date cannot be before the start date",
          );
        }
      }

      const collectionMethod =
        (
          optional(
            x.collectionMethod,
          ) ??
          "direct_debit"
        )
          .toLowerCase()
          .trim();

      const allowedCollectionMethods = [
        "direct_debit",
        "online",
      ];

      if (
        !allowedCollectionMethods.includes(
          collectionMethod,
        )
      ) {
        throw new ApiError(
          400,
          "Collection method must be direct_debit or online",
        );
      }

      const existing =
        await first<{
          id: string;
        }>(
          `select id

           from student_fee_agreements

           where
             student_id = ?
             and fee_plan_id = ?
             and status = 'active'

           limit 1`,
          studentId,
          feePlanId,
        );

      if (existing) {
        throw new ApiError(
          409,
          `${student.first_name} ${student.last_name} already has an active agreement for this fee plan`,
        );
      }

      const id =
        crypto.randomUUID();

      const row =
        await first(
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
             ?, ?, ?, ?, ?, ?,
             ?, ?, ?, 'active'
           )

           returning *`,
          id,
          studentId,
          feePlanId,
          monthlyAmountPence,
          discountPence,
          billingDay,
          startsOn,
          endsOn,
          collectionMethod,
        );

      if (!row) {
        throw new ApiError(
          500,
          "Student fee agreement could not be created",
        );
      }

      await audit(
        who,
        "create-fee-agreement",
        "student_fee_agreements",
        id,
        {
          studentId,
          studentName:
            `${student.first_name} ${student.last_name}`,
          feePlanId,
          feePlanName:
            plan.name,
          monthlyAmountPence,
          discountPence,
          billingDay,
          startsOn,
          endsOn,
          collectionMethod,
        },
      );

      return json(
        {
          ok: true,
          data: row,
        },
        201,
      );
    }

    /*
     * GENERATE MONTHLY INVOICES FOR EVERY ACTIVE STUDENT
     *
     * This is the normal one-admin workflow. It repairs missing fee
     * agreements automatically and skips invoices that already exist.
     */
    if (
      action ===
      "generate-monthly-invoices"
    ) {
      const billingYear =
        integer(
          x.billingYear,
          "Billing year",
          2020,
        );

      if (billingYear > 2100) {
        throw new ApiError(
          400,
          "Billing year is not valid",
        );
      }

      const billingMonth =
        integer(
          x.billingMonth,
          "Billing month",
          1,
        );

      if (billingMonth > 12) {
        throw new ApiError(
          400,
          "Billing month must be between 1 and 12",
        );
      }

      const standardPlan =
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

      if (!standardPlan) {
        throw new ApiError(
          409,
          "The standard £30 monthly fee has not been configured.",
        );
      }

      const periodStart =
        `${billingYear}-${String(
          billingMonth,
        ).padStart(2, "0")}-01`;

      const periodEnd =
        new Date(
          Date.UTC(
            billingYear,
            billingMonth,
            0,
          ),
        )
          .toISOString()
          .slice(0, 10);

      const candidates =
        await all<{
          student_id: string;
          student_name: string;
          enrolled_on: string;
          agreement_id: string | null;
          agreement_starts_on: string | null;
          agreement_ends_on: string | null;
          invoice_id: string | null;
        }>(
          `select
             s.id as student_id,
             s.first_name || ' ' || s.last_name as student_name,
             min(substr(e.enrolled_at, 1, 10)) as enrolled_on,
             sfa.id as agreement_id,
             sfa.starts_on as agreement_starts_on,
             sfa.ends_on as agreement_ends_on,
             fi.id as invoice_id
           from students s
           join enrolments e
             on e.student_id = s.id
            and e.status = 'active'
           left join student_fee_agreements sfa
             on sfa.id = (
               select a.id
               from student_fee_agreements a
               where
                 a.student_id = s.id
                 and a.status = 'active'
               order by a.created_at
               limit 1
             )
           left join fee_invoices fi
             on fi.agreement_id = sfa.id
            and fi.billing_year = ?
            and fi.billing_month = ?
           where s.status = 'active'
           group by
             s.id,
             s.first_name,
             s.last_name,
             sfa.id,
             sfa.starts_on,
             sfa.ends_on,
             fi.id
           order by s.last_name, s.first_name`,
          billingYear,
          billingMonth,
        );

      const statements: D1PreparedStatement[] = [];
      let created = 0;
      let skipped = 0;
      let agreementsCreated = 0;

      for (const candidate of candidates) {
        const startsOn =
          candidate.agreement_starts_on ??
          candidate.enrolled_on;

        if (
          !startsOn ||
          periodEnd < startsOn ||
          (
            candidate.agreement_ends_on &&
            periodStart > candidate.agreement_ends_on
          )
        ) {
          skipped += 1;
          continue;
        }

        const agreementId =
          candidate.agreement_id ??
          crypto.randomUUID();

        if (!candidate.agreement_id) {
          statements.push(
            d1()
              .prepare(
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
                   ?, ?, ?, 3000, 0, 1,
                   ?, null, 'online', 'active'
                 )`,
              )
              .bind(
                agreementId,
                candidate.student_id,
                standardPlan.id,
                startsOn,
              ),
          );
          agreementsCreated += 1;
        }

        if (candidate.invoice_id) {
          skipped += 1;
          continue;
        }

        const dueDate =
          startsOn >= periodStart &&
          startsOn <= periodEnd
            ? startsOn
            : periodStart;

        statements.push(
          d1()
            .prepare(
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
              candidate.student_id,
              agreementId,
              billingYear,
              billingMonth,
              `Monthly Madrasah Fee - ${monthName(
                billingYear,
                billingMonth,
              )}`,
              dueDate,
            ),
        );
        created += 1;
      }

      if (statements.length) {
        await d1().batch(statements);
      }

      await audit(
        who,
        "generate-monthly-fee-invoices",
        "fee_invoices",
        `${billingYear}-${String(
          billingMonth,
        ).padStart(2, "0")}`,
        {
          billingYear,
          billingMonth,
          created,
          skipped,
          agreementsCreated,
        },
      );

      return json({
        ok: true,
        created,
        skipped,
        agreementsCreated,
        billingYear,
        billingMonth,
      });
    }

    /*
     * GENERATE ONE MONTHLY INVOICE (retained for a student profile)
     */
    if (
      action ===
      "generate-invoice"
    ) {
      const agreementId =
        required(
          x.agreementId,
          "Fee agreement",
        );

      const billingYear =
        integer(
          x.billingYear,
          "Billing year",
          2020,
        );

      if (
        billingYear >
        2100
      ) {
        throw new ApiError(
          400,
          "Billing year is not valid",
        );
      }

      const billingMonth =
        integer(
          x.billingMonth,
          "Billing month",
          1,
        );

      if (
        billingMonth >
        12
      ) {
        throw new ApiError(
          400,
          "Billing month must be between 1 and 12",
        );
      }

      const agreement =
        await first<{
          id: string;
          student_id: string;
          fee_plan_id: string | null;
          monthly_amount_pence: number;
          discount_pence: number;
          billing_day: number;
          starts_on: string;
          ends_on: string | null;
          collection_method: string;
          status: string;
          first_name: string;
          last_name: string;
          student_status: string;
          plan_name: string | null;
        }>(
          `select
             sfa.*,

             s.first_name,
             s.last_name,

             s.status
               as student_status,

             fp.name
               as plan_name

           from student_fee_agreements sfa

           join students s
             on s.id =
                sfa.student_id

           left join fee_plans fp
             on fp.id =
                sfa.fee_plan_id

           where
             sfa.id = ?

           limit 1`,
          agreementId,
        );

      if (!agreement) {
        throw new ApiError(
          404,
          "Fee agreement not found",
        );
      }

      if (
        agreement.status !==
        "active"
      ) {
        throw new ApiError(
          409,
          "Invoice cannot be generated from an inactive fee agreement",
        );
      }

      if (
        agreement.student_status !==
        "active"
      ) {
        throw new ApiError(
          409,
          "Invoice cannot be generated because the student is not active",
        );
      }

      const periodStart =
        `${billingYear}-${String(
          billingMonth,
        ).padStart(
          2,
          "0",
        )}-01`;

      const periodEnd =
        new Date(
          Date.UTC(
            billingYear,
            billingMonth,
            0,
          ),
        )
          .toISOString()
          .slice(
            0,
            10,
          );

      if (
        periodEnd <
        agreement.starts_on
      ) {
        throw new ApiError(
          409,
          "This billing period is before the fee agreement start date",
        );
      }

      if (
        agreement.ends_on &&
        periodStart >
          agreement.ends_on
      ) {
        throw new ApiError(
          409,
          "This billing period is after the fee agreement end date",
        );
      }

      const duplicate =
        await first<{
          id: string;
        }>(
          `select id

           from fee_invoices

           where
             agreement_id = ?
             and billing_year = ?
             and billing_month = ?

           limit 1`,
          agreementId,
          billingYear,
          billingMonth,
        );

      if (duplicate) {
        throw new ApiError(
          409,
          "An invoice already exists for this student agreement and billing period",
        );
      }

      const amountPence =
        Number(
          agreement.monthly_amount_pence,
        );

      const discountPence =
        Number(
          agreement.discount_pence,
        );

      const amountDuePence =
        Math.max(
          0,
          amountPence -
            discountPence,
        );

      const dueDate =
        `${billingYear}-${String(
          billingMonth,
        ).padStart(
          2,
          "0",
        )}-${String(
          agreement.billing_day,
        ).padStart(
          2,
          "0",
        )}`;

      const description =
        `${
          agreement.plan_name ??
          "Madrasah fee"
        } - ${monthName(
          billingYear,
          billingMonth,
        )}`;

      const id =
        crypto.randomUUID();

      const row =
        await first(
          `insert into fee_invoices
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
             ?, ?, ?, 0, ?,
             'pending'
           )

           returning *`,
          id,
          agreement.student_id,
          agreementId,
          billingYear,
          billingMonth,
          description,
          amountPence,
          discountPence,
          amountDuePence,
          dueDate,
        );

      if (!row) {
        throw new ApiError(
          500,
          "Invoice could not be generated",
        );
      }

      await audit(
        who,
        "generate-fee-invoice",
        "fee_invoices",
        id,
        {
          agreementId,
          studentId:
            agreement.student_id,
          studentName:
            `${agreement.first_name} ${agreement.last_name}`,
          billingYear,
          billingMonth,
          amountPence,
          discountPence,
          amountDuePence,
          dueDate,
          collectionMethod:
            agreement.collection_method,
        },
      );

      return json(
        {
          ok: true,
          data: row,
        },
        201,
      );
    }

    throw new ApiError(
      400,
      "Unknown billing action",
    );
  } catch (error) {
    return fail(error);
  }
}

