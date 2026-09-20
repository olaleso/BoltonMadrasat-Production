import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  optional,
  required,
  ApiError,
} from "@/lib/backend";


type StudentRow = {
  id: string;
  student_number: string;
  student_name: string;
};

type InvoiceRow = {
  id: string;
  student_id: string;
  class_id: string | null;
  fee_type: string;
  billing_year: number;
  billing_month: number;
  academic_year_key: string | null;
  description: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  due_date: string;
  status: string;
  created_at: string;
};

type RuleRow = {
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

function parsePeriod(
  request: Request,
) {
  const url =
    new URL(
      request.url,
    );

  const year =
    Number(
      url.searchParams.get(
        "year",
      ),
    );

  const month =
    Number(
      url.searchParams.get(
        "month",
      ),
    );

  const classId =
    String(
      url.searchParams.get(
        "classId",
      ) ??
        "",
    ).trim();

  if (
    !Number.isInteger(
      year,
    ) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new ApiError(
      400,
      "A valid reconciliation year is required.",
    );
  }

  if (
    !Number.isInteger(
      month,
    ) ||
    month < 1 ||
    month > 12
  ) {
    throw new ApiError(
      400,
      "A valid reconciliation month is required.",
    );
  }

  if (
    !classId
  ) {
    throw new ApiError(
      400,
      "Class is required.",
    );
  }

  return {
    year,
    month,
    classId,
  };
}

function academicYearKey(
  year: number,
  month: number,
) {
  return month >= 9
    ? `${year}/${year + 1}`
    : `${year - 1}/${year}`;
}

function monthLabel(
  year: number,
  month: number,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month:
        "long",
      year:
        "numeric",
      timeZone:
        "UTC",
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

function dueDate(
  year: number,
  month: number,
  billingDay: number,
) {
  const maxDay =
    new Date(
      Date.UTC(
        year,
        month,
        0,
      ),
    ).getUTCDate();

  const day =
    Math.max(
      1,
      Math.min(
        maxDay,
        billingDay,
      ),
    );

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function paymentTimestamp(
  value: unknown,
) {
  const raw =
    optional(
      value,
    );

  if (
    !raw
  ) {
    return new Date()
      .toISOString();
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      raw,
    )
  ) {
    throw new ApiError(
      400,
      "Payment date must be in YYYY-MM-DD format.",
    );
  }

  const parsed =
    new Date(
      `${raw}T12:00:00Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new ApiError(
      400,
      "Payment date is invalid.",
    );
  }

  return parsed
    .toISOString();
}

function reference(
  prefix:
    string,
) {
  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      )
      .replaceAll(
        "-",
        "",
      );

  return `${prefix}-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function currentStudents(
  classId: string,
) {
  const result =
    await d1()
      .prepare(
        `select distinct
           s.id,
           s.student_number,
           trim(
             s.first_name ||
             ' ' ||
             s.last_name
           ) as student_name
         from enrolments e
         join students s
           on s.id =
              e.student_id
         where e.class_id = ?
           and e.status = 'active'
           and s.status = 'active'
         order by
           s.last_name,
           s.first_name`,
      )
      .bind(
        classId,
      )
      .all<StudentRow>();

  return result.results;
}

async function prepareMonth(
  who: Awaited<ReturnType<typeof actor>>,
  classId: string,
  year: number,
  month: number,
) {
  const db =
    d1();

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
      "Class not found.",
    );
  }

  const rules =
    await db
      .prepare(
        `select *
         from class_fee_rules
         where active = 1
           and (
             class_id = ?
             or class_id is null
           )`,
      )
      .bind(
        classId,
      )
      .all<RuleRow>();

  const monthlyRule =
    rules.results.find(
      (rule) =>
        rule.fee_code ===
          "madrasah" &&
        rule.class_id ===
          classId,
    );

  const booksRule =
    rules.results.find(
      (rule) =>
        rule.fee_code ===
          "books" &&
        rule.class_id ===
          null,
    );

  if (
    !monthlyRule
  ) {
    throw new ApiError(
      409,
      "This class does not yet have a monthly Madrasah fee. Set the class fee first.",
    );
  }

  const students =
    await currentStudents(
      classId,
    );

  const academicYear =
    academicYearKey(
      year,
      month,
    );

  let created =
    0;

  for (
    const student of
      students
  ) {
    const agreement =
      await db
        .prepare(
          `select
             id,
             discount_pence
           from student_fee_agreements
           where student_id = ?
             and status = 'active'
           order by created_at desc
           limit 1`,
        )
        .bind(
          student.id,
        )
        .first<{
          id: string;
          discount_pence: number;
        }>();

    const existingMonthly =
      await db
        .prepare(
          `select id, class_id
           from fee_invoices
           where student_id = ?
             and billing_year = ?
             and billing_month = ?
             and fee_type = 'madrasah'
           order by created_at
           limit 1`,
        )
        .bind(
          student.id,
          year,
          month,
        )
        .first<{
          id: string;
          class_id: string | null;
        }>();

    if (
      existingMonthly
    ) {
      /*
       * Adopt legacy monthly invoices into this class reconciliation
       * without changing their historical amount.
       */
      if (
        !existingMonthly.class_id
      ) {
        await db
          .prepare(
            `update fee_invoices
             set
               class_id = ?,
               academic_year_key = ?,
               fee_frequency = 'monthly',
               fee_rule_id = ?,
               updated_at = CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            classId,
            academicYear,
            monthlyRule.id,
            existingMonthly.id,
          )
          .run();
      }
    }
    else {
      const discount =
        Math.max(
          0,
          Number(
            agreement
              ?.discount_pence ??
              0,
          ),
        );

      const amount =
        Math.max(
          0,
          Number(
            monthlyRule.amount_pence,
          ),
        );

      const amountDue =
        Math.max(
          0,
          amount -
            discount,
        );

      await db
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
           values (
             ?, ?, ?, ?, ?,
             ?, ?, ?, ?, 0,
             ?, 'pending',
             'madrasah',
             ?, ?,
             'monthly',
             ?
           )`,
        )
        .bind(
          crypto.randomUUID(),
          student.id,
          agreement?.id ??
            null,
          year,
          month,
          `${monthlyRule.label} - ${monthLabel(year, month)}`,
          amount,
          discount,
          amountDue,
          dueDate(
            year,
            month,
            monthlyRule.billing_day ??
              1,
          ),
          classId,
          academicYear,
          monthlyRule.id,
        )
        .run();

      created +=
        1;
    }

    if (
      booksRule &&
      Number(
        booksRule.charge_month,
      ) ===
        month
    ) {
      const existingBooks =
        await db
          .prepare(
            `select id
             from fee_invoices
             where student_id = ?
               and fee_type = 'books'
               and academic_year_key = ?
             limit 1`,
          )
          .bind(
            student.id,
            academicYear,
          )
          .first<{
            id: string;
          }>();

      if (
        !existingBooks
      ) {
        await db
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
             values (
               ?, ?, NULL, ?, ?,
               ?, ?, 0, ?, 0,
               ?, 'pending',
               'books',
               ?, ?,
               'annual',
               ?
             )`,
          )
          .bind(
            crypto.randomUUID(),
            student.id,
            year,
            month,
            `${booksRule.label} - ${academicYear}`,
            booksRule.amount_pence,
            booksRule.amount_pence,
            dueDate(
              year,
              month,
              booksRule.billing_day ??
                1,
            ),
            classId,
            academicYear,
            booksRule.id,
          )
          .run();

        created +=
          1;
      }
    }
  }

  await audit(
    who,
    "prepare-fee-reconciliation-month",
    "fee_invoices",
    undefined,
    {
      classId,
      className:
        classRow.name,
      year,
      month,
      academicYear,
      students:
        students.length,
      invoicesCreated:
        created,
    },
  );

  return {
    created,
    students:
      students.length,
  };
}

async function reconciliationData(
  classId: string,
  year: number,
  month: number,
) {
  const db =
    d1();

  const classRow =
    await db
      .prepare(
        `select id, name
         from classes
         where id = ?
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
      "Class not found.",
    );
  }

  const students =
    await currentStudents(
      classId,
    );

  const academicYear =
    academicYearKey(
      year,
      month,
    );

  const invoicesResult =
    await db
      .prepare(
        `select fi.*
         from fee_invoices fi
         where fi.student_id in (
           select student_id
           from enrolments
           where class_id = ?
         )
         and fi.status not in (
           'cancelled',
           'waived'
         )
         order by
           fi.due_date,
           fi.created_at`,
      )
      .bind(
        classId,
      )
      .all<InvoiceRow>();

  const paymentResult =
    await db
      .prepare(
        `select
           pt.id,
           pt.student_id,
           pt.provider,
           pt.provider_reference,
           pt.amount_pence,
           pt.paid_at,
           pt.metadata_json
         from payment_transactions pt
         where pt.student_id in (
           select student_id
           from enrolments
           where class_id = ?
         )
         and pt.status = 'paid'
         order by
           coalesce(
             pt.paid_at,
             pt.created_at
           ) desc`,
      )
      .bind(
        classId,
      )
      .all<{
        id: string;
        student_id: string;
        provider: string;
        provider_reference: string | null;
        amount_pence: number;
        paid_at: string | null;
        metadata_json: string | null;
      }>();

  const invoices =
    invoicesResult.results;

  const payments =
    paymentResult.results;

  const rows =
    students.map(
      (
        student,
      ) => {
        const studentInvoices =
          invoices.filter(
            (invoice) =>
              invoice.student_id ===
              student.id,
          );

        const monthly =
          studentInvoices.find(
            (invoice) =>
              invoice.fee_type ===
                "madrasah" &&
              Number(
                invoice.billing_year,
              ) ===
                year &&
              Number(
                invoice.billing_month,
              ) ===
                month,
          );

        const books =
          studentInvoices.find(
            (invoice) =>
              invoice.fee_type ===
                "books" &&
              invoice.academic_year_key ===
                academicYear,
          );

        const booksThisMonth =
          books &&
          Number(
            books.billing_year,
          ) ===
            year &&
          Number(
            books.billing_month,
          ) ===
            month;

        const selectedPeriodInvoices =
          studentInvoices.filter(
            (invoice) =>
              Number(
                invoice.billing_year,
              ) ===
                year &&
              Number(
                invoice.billing_month,
              ) ===
                month,
          );

        const currentExpected =
          selectedPeriodInvoices.reduce(
            (
              total,
              invoice,
            ) =>
              total +
              Number(
                invoice.amount_due_pence ??
                  0,
              ),
            0,
          );

        const currentPaid =
          selectedPeriodInvoices.reduce(
            (
              total,
              invoice,
            ) =>
              total +
              Number(
                invoice.amount_paid_pence ??
                  0,
              ),
            0,
          );

        const currentOutstanding =
          Math.max(
            0,
            currentExpected -
              currentPaid,
          );

        const selectedPeriodNumber =
          year *
            100 +
          month;

        const arrears =
          studentInvoices
            .filter(
              (
                invoice,
              ) =>
                invoice.billing_year *
                  100 +
                  invoice.billing_month <
                  selectedPeriodNumber,
            )
            .reduce(
              (
                total,
                invoice,
              ) =>
                total +
                Math.max(
                  0,
                  Number(
                    invoice.amount_due_pence ??
                      0,
                  ) -
                    Number(
                      invoice.amount_paid_pence ??
                        0,
                    ),
                ),
              0,
            );

        const totalOutstanding =
          studentInvoices.reduce(
            (
              total,
              invoice,
            ) =>
              total +
              Math.max(
                0,
                Number(
                  invoice.amount_due_pence ??
                    0,
                ) -
                  Number(
                    invoice.amount_paid_pence ??
                      0,
                  ),
              ),
            0,
          );

        const latestPayment =
          payments.find(
            (payment) =>
              payment.student_id ===
              student.id,
          );

        let status =
          "unpaid";

        if (
          currentExpected >
            0 &&
          currentOutstanding ===
            0
        ) {
          status =
            "paid";
        }
        else if (
          currentPaid >
          0
        ) {
          status =
            "part_paid";
        }

        return {
          studentId:
            student.id,
          studentNumber:
            student.student_number,
          studentName:
            student.student_name,

          monthlyInvoiceId:
            monthly?.id ??
            null,
          monthlyExpectedPence:
            Number(
              monthly
                ?.amount_due_pence ??
                0,
            ),
          monthlyPaidPence:
            Number(
              monthly
                ?.amount_paid_pence ??
                0,
            ),
          monthlyOutstandingPence:
            monthly
              ? Math.max(
                  0,
                  Number(
                    monthly.amount_due_pence,
                  ) -
                    Number(
                      monthly.amount_paid_pence,
                    ),
                )
              : 0,

          booksInvoiceId:
            books?.id ??
            null,
          booksExpectedPence:
            Number(
              books
                ?.amount_due_pence ??
                0,
            ),
          booksPaidPence:
            Number(
              books
                ?.amount_paid_pence ??
                0,
            ),
          booksOutstandingPence:
            books
              ? Math.max(
                  0,
                  Number(
                    books.amount_due_pence,
                  ) -
                    Number(
                      books.amount_paid_pence,
                    ),
                )
              : 0,
          booksChargedThisMonth:
            Boolean(
              booksThisMonth,
            ),

          currentExpectedPence:
            currentExpected,
          currentPaidPence:
            currentPaid,
          currentOutstandingPence:
            currentOutstanding,
          arrearsPence:
            arrears,
          totalOutstandingPence:
            totalOutstanding,
          status,

          lastPaymentDate:
            latestPayment
              ?.paid_at ??
            null,
          lastPaymentMethod:
            latestPayment
              ?.provider ??
            null,
          lastPaymentReference:
            latestPayment
              ?.provider_reference ??
            null,
        };
      },
    );

  const summary =
    rows.reduce(
      (
        total,
        row,
      ) => {
        total.expectedPence +=
          row.currentExpectedPence;
        total.receivedPence +=
          row.currentPaidPence;
        total.outstandingPence +=
          row.currentOutstandingPence;
        total.arrearsPence +=
          row.arrearsPence;
        total.totalOutstandingPence +=
          row.totalOutstandingPence;

        if (
          row.status ===
          "paid"
        ) {
          total.paid +=
            1;
        }
        else if (
          row.status ===
          "part_paid"
        ) {
          total.partPaid +=
            1;
        }
        else {
          total.unpaid +=
            1;
        }

        return total;
      },
      {
        students:
          rows.length,
        expectedPence:
          0,
        receivedPence:
          0,
        outstandingPence:
          0,
        arrearsPence:
          0,
        totalOutstandingPence:
          0,
        paid:
          0,
        partPaid:
          0,
        unpaid:
          0,
      },
    );

  return {
    class: classRow,
    year,
    month,
    monthLabel:
      monthLabel(
        year,
        month,
      ),
    academicYear,
    summary,
    rows,
  };
}

async function paymentHistory(
  studentId: string,
) {
  const result =
    await d1()
      .prepare(
        `select
           pt.id,
           pt.provider,
           pt.provider_reference,
           pt.amount_pence,
           pt.paid_at,
           pt.created_at,
           pt.metadata_json,
           group_concat(
             fi.description ||
             '|' ||
             ipa.amount_pence,
             ';;'
           ) as allocations
         from payment_transactions pt
         left join invoice_payment_allocations ipa
           on ipa.transaction_id =
              pt.id
         left join fee_invoices fi
           on fi.id =
              ipa.invoice_id
         where pt.student_id = ?
           and pt.status = 'paid'
         group by pt.id
         order by
           coalesce(
             pt.paid_at,
             pt.created_at
           ) desc`,
      )
      .bind(
        studentId,
      )
      .all<{
        id: string;
        provider: string;
        provider_reference: string | null;
        amount_pence: number;
        paid_at: string | null;
        created_at: string;
        metadata_json: string | null;
        allocations: string | null;
      }>();

  return result.results.map(
    (
      payment,
    ) => {
      let note:
        string | null =
          null;

      try {
        const metadata =
          JSON.parse(
            payment.metadata_json ??
              "{}",
          ) as {
            note?: string | null;
          };

        note =
          metadata.note ??
          null;
      }
      catch {}

      return {
        id:
          payment.id,
        provider:
          payment.provider,
        reference:
          payment.provider_reference,
        amountPence:
          payment.amount_pence,
        paidAt:
          payment.paid_at ??
          payment.created_at,
        note,
        allocations:
          String(
            payment.allocations ??
              "",
          )
            .split(
              ";;",
            )
            .filter(
              Boolean,
            )
            .map(
              (
                allocation,
              ) => {
                const [
                  description,
                  amount,
                ] =
                  allocation.split(
                    "|",
                  );

                return {
                  description,
                  amountPence:
                    Number(
                      amount ??
                        0,
                    ),
                };
              },
            ),
      };
    },
  );
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

    const url =
      new URL(
        request.url,
      );

    const historyStudentId =
      String(
        url.searchParams.get(
          "historyStudentId",
        ) ??
          "",
      ).trim();

    if (
      historyStudentId
    ) {
      return json({
        ok: true,
        payments:
          await paymentHistory(
            historyStudentId,
          ),
      });
    }

    const {
      year,
      month,
      classId,
    } =
      parsePeriod(
        request,
      );

    return json({
      ok: true,
      ...await reconciliationData(
        classId,
        year,
        month,
      ),
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
      input.action ===
      "prepare"
    ) {
      const classId =
        required(
          input.classId,
          "Class",
        );

      const year =
        Number(
          input.year,
        );

      const month =
        Number(
          input.month,
        );

      if (
        !Number.isInteger(
          year,
        ) ||
        !Number.isInteger(
          month,
        ) ||
        month < 1 ||
        month > 12
      ) {
        throw new ApiError(
          400,
          "A valid month is required.",
        );
      }

      const prepared =
        await prepareMonth(
          who,
          classId,
          year,
          month,
        );

      return json({
        ok: true,
        ...prepared,
      });
    }

    if (
      input.action ===
      "record_payment"
    ) {
      const studentId =
        required(
          input.studentId,
          "Student",
        );

      const rawAmount =
        Number(
          input.amountPence,
        );

      if (
        !Number.isInteger(
          rawAmount,
        ) ||
        rawAmount < 1
      ) {
        throw new ApiError(
          400,
          "Payment amount must be greater than zero.",
        );
      }

      const method =
        String(
          input.method ??
            "",
        )
          .trim()
          .toLowerCase();

      if (
        ![
          "bank_transfer",
          "cash",
          "other",
        ].includes(
          method,
        )
      ) {
        throw new ApiError(
          400,
          "Payment method must be bank transfer, cash or other.",
        );
      }

      const suppliedReference =
        optional(
          input.reference,
        )
          ?.trim()
          .slice(
            0,
            120,
          ) ??
        "";

      if (
        method ===
          "bank_transfer" &&
        !suppliedReference
      ) {
        throw new ApiError(
          400,
          "Bank transfer reference is required.",
        );
      }

      const note =
        optional(
          input.note,
        )
          ?.trim()
          .slice(
            0,
            300,
          ) ??
        "";

      const paidAt =
        paymentTimestamp(
          input.paymentDate,
        );

      const student =
        await d1()
          .prepare(
            `select
               id,
               student_number,
               trim(
                 first_name ||
                 ' ' ||
                 last_name
               ) as student_name
             from students
             where id = ?
             limit 1`,
          )
          .bind(
            studentId,
          )
          .first<{
            id: string;
            student_number: string;
            student_name: string;
          }>();

      if (
        !student
      ) {
        throw new ApiError(
          404,
          "Student not found.",
        );
      }

      const invoices =
        await d1()
          .prepare(
            `select
               id,
               amount_due_pence,
               amount_paid_pence,
               due_date,
               description
             from fee_invoices
             where student_id = ?
               and status not in (
                 'paid',
                 'cancelled',
                 'waived'
               )
               and amount_paid_pence <
                   amount_due_pence
             order by
               due_date,
               created_at`,
          )
          .bind(
            studentId,
          )
          .all<{
            id: string;
            amount_due_pence: number;
            amount_paid_pence: number;
            due_date: string;
            description: string;
          }>();

      const totalOutstanding =
        invoices.results.reduce(
          (
            total,
            invoice,
          ) =>
            total +
            Math.max(
              0,
              Number(
                invoice.amount_due_pence,
              ) -
                Number(
                  invoice.amount_paid_pence,
                ),
            ),
          0,
        );

      if (
        rawAmount >
        totalOutstanding
      ) {
        throw new ApiError(
          409,
          `Payment is £${(rawAmount / 100).toFixed(2)}, but this student only has £${(totalOutstanding / 100).toFixed(2)} outstanding. Credit balances are not supported yet.`,
        );
      }

      let remaining =
        rawAmount;

      const allocations:
        {
          invoiceId: string;
          amountPence: number;
          description: string;
        }[] =
          [];

      for (
        const invoice of
          invoices.results
      ) {
        if (
          remaining <=
          0
        ) {
          break;
        }

        const outstanding =
          Math.max(
            0,
            Number(
              invoice.amount_due_pence,
            ) -
              Number(
                invoice.amount_paid_pence,
              ),
          );

        const allocated =
          Math.min(
            remaining,
            outstanding,
          );

        if (
          allocated >
          0
        ) {
          allocations.push({
            invoiceId:
              invoice.id,
            amountPence:
              allocated,
            description:
              invoice.description,
          });

          remaining -=
            allocated;
        }
      }

      if (
        remaining >
        0 ||
        !allocations.length
      ) {
        throw new ApiError(
          409,
          "Unable to allocate this payment to outstanding fees.",
        );
      }

      const guardian =
        await d1()
          .prepare(
            `select g.id
             from student_guardians sg
             join guardians g
               on g.id =
                  sg.guardian_id
             where sg.student_id = ?
             order by
               sg.is_primary desc,
               sg.created_at
             limit 1`,
          )
          .bind(
            studentId,
          )
          .first<{
            id: string;
          }>();

      const transactionId =
        crypto.randomUUID();

      const receiptId =
        crypto.randomUUID();

      const providerReference =
        suppliedReference ||
        reference(
          method ===
            "cash"
            ? "CASH"
            : "MANUAL",
        );

      const receiptNumber =
        reference(
          "RCPT",
        );

      const db =
        d1();

      const statements = [
        db
          .prepare(
            `insert into payment_transactions
               (
                 id,
                 student_id,
                 guardian_id,
                 invoice_id,
                 provider,
                 provider_reference,
                 amount_pence,
                 currency,
                 purpose,
                 status,
                 paid_at,
                 metadata_json
               )
             values (
               ?, ?, ?, ?,
               ?, ?, ?,
               'GBP',
               'fee_reconciliation',
               'paid',
               ?,
               ?
             )`,
          )
          .bind(
            transactionId,
            studentId,
            guardian?.id ??
              null,
            allocations[0]
              .invoiceId,
            method,
            providerReference,
            rawAmount,
            paidAt,
            JSON.stringify({
              source:
                "admin_fee_reconciliation",
              recordedBy:
                who.id,
              note:
                note ||
                null,
              allocations:
                allocations.map(
                  (
                    allocation,
                  ) => ({
                    invoiceId:
                      allocation.invoiceId,
                    amountPence:
                      allocation.amountPence,
                  }),
                ),
            }),
          ),
      ];

      for (
        const allocation of
          allocations
      ) {
        statements.push(
          db
            .prepare(
              `insert into invoice_payment_allocations
                 (
                   id,
                   invoice_id,
                   transaction_id,
                   amount_pence
                 )
               values (?, ?, ?, ?)`,
            )
            .bind(
              crypto.randomUUID(),
              allocation.invoiceId,
              transactionId,
              allocation.amountPence,
            ),
        );

        statements.push(
          db
            .prepare(
              `update fee_invoices
               set
                 amount_paid_pence =
                   min(
                     amount_due_pence,
                     amount_paid_pence + ?
                   ),
                 status =
                   case
                     when amount_paid_pence + ? >= amount_due_pence
                     then 'paid'
                     else 'part_paid'
                   end,
                 updated_at =
                   CURRENT_TIMESTAMP
               where id = ?`,
            )
            .bind(
              allocation.amountPence,
              allocation.amountPence,
              allocation.invoiceId,
            ),
        );
      }

      statements.push(
        db
          .prepare(
            `insert into receipts
               (
                 id,
                 receipt_number,
                 transaction_id,
                 guardian_id,
                 student_id,
                 amount_pence,
                 currency,
                 purpose,
                 issued_at
               )
             values (
               ?, ?, ?, ?, ?,
               ?, 'GBP',
               'fee_reconciliation',
               ?
             )`,
          )
          .bind(
            receiptId,
            receiptNumber,
            transactionId,
            guardian?.id ??
              null,
            studentId,
            rawAmount,
            paidAt,
          ),
      );

      await db.batch(
        statements,
      );

      await audit(
        who,
        "record-manual-fee-payment",
        "payment_transactions",
        transactionId,
        {
          studentId,
          studentNumber:
            student.student_number,
          studentName:
            student.student_name,
          amountPence:
            rawAmount,
          method,
          reference:
            providerReference,
          paymentDate:
            paidAt,
          note:
            note ||
            null,
          allocations,
        },
      );

      return json({
        ok: true,
        transactionId,
        receiptNumber,
        amountPence:
          rawAmount,
        allocations,
      });
    }

    throw new ApiError(
      400,
      "Unknown reconciliation action.",
    );
  }
  catch (
    error
  ) {
    return fail(
      error,
    );
  }
}
