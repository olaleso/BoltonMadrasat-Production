import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

type FeeRuleRow = {
  id: string;
  class_id: string | null;
  fee_code: string;
  label: string;
  amount_pence: number;
  frequency: string;
  billing_day: number;
  charge_month: number | null;
  active: number;
};

function amountPence(
  value: unknown,
  label: string,
) {
  const amount =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      amount,
    ) ||
    amount < 0 ||
    amount > 1000000
  ) {
    throw new ApiError(
      400,
      `${label} must be a valid amount.`,
    );
  }

  return amount;
}

function monthNumber(
  value: unknown,
) {
  const month =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      month,
    ) ||
    month < 1 ||
    month > 12
  ) {
    throw new ApiError(
      400,
      "Books charge month must be between 1 and 12.",
    );
  }

  return month;
}

export async function GET(
  request: Request,
) {
  try {
    await actor(
      request,
      [
        "admin",
        "finance",
      ],
    );

    const classes =
      await d1()
        .prepare(
          `select
             c.id,
             c.name,
             c.status,
             count(
               case
                 when e.status = 'active'
                 then 1
               end
             ) as enrolled
           from classes c
           left join enrolments e
             on e.class_id = c.id
           where c.status = 'active'
           group by c.id
           order by c.name`,
        )
        .all<{
          id: string;
          name: string;
          status: string;
          enrolled: number;
        }>();

    const rules =
      await d1()
        .prepare(
          `select *
           from class_fee_rules
           order by
             case
               when class_id is null
               then 0
               else 1
             end,
             fee_code,
             class_id`,
        )
        .all<FeeRuleRow>();

    return json({
      ok: true,
      classes:
        classes.results,
      rules:
        rules.results,
    });
  }
  catch (
    error
  ) {
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
          "finance",
        ],
      );

    const input =
      await body(
        request,
      );

    if (
      input.action !==
      "save_all"
    ) {
      throw new ApiError(
        400,
        "Unknown fee setup action.",
      );
    }

    const monthlyRules =
      Array.isArray(
        input.monthlyRules,
      )
        ? input.monthlyRules
        : [];

    const books =
      input.books &&
      typeof input.books ===
        "object"
        ? input.books as Record<
            string,
            unknown
          >
        : {};

    const db =
      d1();

    const statements = [];

    for (
      const item of
        monthlyRules
    ) {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        continue;
      }

      const row =
        item as Record<
          string,
          unknown
        >;

      const classId =
        String(
          row.classId ??
            "",
        ).trim();

      if (
        !classId
      ) {
        continue;
      }

      const classRow =
        await db
          .prepare(
            `select id, name
             from classes
             where id = ?
               and status = 'active'
             limit 1`,
          )
          .bind(
            classId,
          )
          .first<{
            id: string;
            name: string;
          }>();

      if (
        !classRow
      ) {
        throw new ApiError(
          404,
          "One of the selected classes no longer exists.",
        );
      }

      const amount =
        amountPence(
          row.amountPence,
          `${classRow.name} monthly fee`,
        );

      const active =
        row.active ===
          false
          ? 0
          : 1;

      statements.push(
        db
          .prepare(
            `insert into class_fee_rules
               (
                 id,
                 class_id,
                 fee_code,
                 label,
                 amount_pence,
                 frequency,
                 billing_day,
                 active,
                 effective_from,
                 updated_at
               )
             values (
               ?, ?,
               'madrasah',
               'Madrasah fee',
               ?,
               'monthly',
               1,
               ?,
               date('now'),
               CURRENT_TIMESTAMP
             )
             on conflict(class_id, fee_code)
             where class_id is not null
             do update set
               amount_pence = excluded.amount_pence,
               active = excluded.active,
               updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(
            `monthly-${classId}`,
            classId,
            amount,
            active,
          ),
      );

      /*
       * Keep the current student fee agreements aligned with the
       * class-level amount so the existing billing engine and the
       * reconciliation screen use the same future monthly amount.
       * Individual discounts remain untouched.
       */
      statements.push(
        db
          .prepare(
            `update student_fee_agreements
             set
               monthly_amount_pence = ?,
               updated_at = CURRENT_TIMESTAMP
             where status = 'active'
               and student_id in (
                 select student_id
                 from enrolments
                 where class_id = ?
                   and status = 'active'
               )`,
          )
          .bind(
            amount,
            classId,
          ),
      );
    }

    const booksAmount =
      amountPence(
        books.amountPence ??
          1000,
        "Books fee",
      );

    const booksMonth =
      monthNumber(
        books.chargeMonth ??
          9,
      );

    const booksActive =
      books.active ===
        false
        ? 0
        : 1;

    statements.push(
      db
        .prepare(
          `insert into class_fee_rules
             (
               id,
               class_id,
               fee_code,
               label,
               amount_pence,
               frequency,
               billing_day,
               charge_month,
               active,
               effective_from,
               updated_at
             )
           values (
             'books-global',
             NULL,
             'books',
             'Books fee',
             ?,
             'annual',
             1,
             ?,
             ?,
             date('now'),
             CURRENT_TIMESTAMP
           )
           on conflict(fee_code)
           where class_id is null
           do update set
             amount_pence = excluded.amount_pence,
             charge_month = excluded.charge_month,
             active = excluded.active,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          booksAmount,
          booksMonth,
          booksActive,
        ),
    );

    /*
     * Keep the CURRENT academic year's already-created Books invoices
     * aligned with the editable Books fee.
     *
     * Reconciliation reads the amount from fee_invoices, not directly from
     * class_fee_rules. Without this sync, changing Books from £10 to £15
     * updates the setup rule but leaves an already-prepared £10 invoice
     * showing on the reconciliation screen.
     *
     * Historical academic years are intentionally untouched.
     */
    const now =
      new Date();

    const currentYear =
      now.getUTCFullYear();

    const currentMonth =
      now.getUTCMonth() +
      1;

    const currentAcademicYear =
      currentMonth >= 9
        ? `${currentYear}/${currentYear + 1}`
        : `${currentYear - 1}/${currentYear}`;

    statements.push(
      db
        .prepare(
          `update fee_invoices
           set
             amount_pence = ?,
             amount_due_pence =
               case
                 when amount_paid_pence > ?
                 then amount_paid_pence
                 else ?
               end,
             status =
               case
                 when ? = 0
                 then 'waived'
                 when amount_paid_pence >= ?
                 then 'paid'
                 when amount_paid_pence > 0
                 then 'part_paid'
                 else 'pending'
               end,
             fee_rule_id = 'books-global',
             updated_at = CURRENT_TIMESTAMP
           where fee_type = 'books'
             and academic_year_key = ?
             and status <> 'cancelled'`,
        )
        .bind(
          booksAmount,
          booksAmount,
          booksAmount,
          booksAmount,
          booksAmount,
          currentAcademicYear,
        ),
    );

    /*
     * Backfill missing Books invoices for ACTIVE students in the current
     * academic year.
     *
     * This covers students who:
     * - joined after the original September preparation,
     * - had monthly invoices generated through the older billing flow,
     * - or otherwise never received the annual Books charge.
     *
     * Existing Books invoices are not duplicated because of NOT EXISTS.
     */
    if (
      booksActive
    ) {
      const booksBillingYear =
        booksMonth >= 9
          ? Number(
              currentAcademicYear.split(
                "/",
              )[0],
            )
          : Number(
              currentAcademicYear.split(
                "/",
              )[1],
            );

      const booksDueDate =
        `${booksBillingYear}-${String(
          booksMonth,
        ).padStart(
          2,
          "0",
        )}-01`;

      statements.push(
        db
          .prepare(
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
                 status,
                 fee_type,
                 class_id,
                 academic_year_key,
                 fee_frequency,
                 fee_rule_id
               )
             select
               lower(
                 hex(
                   randomblob(16)
                 )
               ),
               s.id,
               NULL,
               ?,
               ?,
               'Books fee - ' || ?,
               ?,
               0,
               ?,
               0,
               ?,
               case
                 when ? = 0
                 then 'waived'
                 else 'pending'
               end,
               'books',
               (
                 select e.class_id
                 from enrolments e
                 where e.student_id = s.id
                   and e.status = 'active'
                 order by e.created_at desc
                 limit 1
               ),
               ?,
               'annual',
               'books-global'
             from students s
             where s.status = 'active'
               and exists (
                 select 1
                 from enrolments e
                 where e.student_id = s.id
                   and e.status = 'active'
               )
               and not exists (
                 select 1
                 from fee_invoices fi
                 where fi.student_id = s.id
                   and fi.fee_type = 'books'
                   and fi.academic_year_key = ?
                   and fi.status <> 'cancelled'
               )`,
          )
          .bind(
            booksBillingYear,
            booksMonth,
            currentAcademicYear,
            booksAmount,
            booksAmount,
            booksDueDate,
            booksAmount,
            currentAcademicYear,
            currentAcademicYear,
          ),
      );
    }

    if (
      statements.length
    ) {
      await db.batch(
        statements,
      );
    }

    await audit(
      who,
      "update-fee-rules",
      "class_fee_rules",
      undefined,
      {
        classRules:
          monthlyRules.length,
        booksAmountPence:
          booksAmount,
        booksChargeMonth:
          booksMonth,
        booksActive:
          Boolean(
            booksActive,
          ),
      },
    );

    return json({
      ok: true,
    });
  }
  catch (
    error
  ) {
    return fail(
      error,
    );
  }
}
