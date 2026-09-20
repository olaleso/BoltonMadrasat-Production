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

type InvoiceRow = {
  id: string;
  student_id: string;
  description: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  status: string;
  guardian_id: string | null;
  student_name: string;
  student_number: string;
};

function cashReference() {
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

  return `CASH-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function receiptNumber() {
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

  return `CASH-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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
    ) ||
    parsed
      .toISOString()
      .slice(
        0,
        10,
      ) !==
      raw
  ) {
    throw new ApiError(
      400,
      "Payment date is not valid.",
    );
  }

  return parsed
    .toISOString();
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

    const invoiceId =
      required(
        input.invoiceId,
        "Invoice",
      );

    const note =
      optional(
        input.note,
      )
        ?.trim()
        .slice(
          0,
          200,
        ) ??
      "";

    const paidAt =
      paymentTimestamp(
        input.paymentDate,
      );

    const invoice =
      await d1()
        .prepare(
          `select
             fi.id,
             fi.student_id,
             fi.description,
             fi.amount_due_pence,
             fi.amount_paid_pence,
             fi.status,

             s.student_number,

             trim(
               s.first_name ||
               ' ' ||
               s.last_name
             ) as student_name,

             g.id
               as guardian_id

           from fee_invoices fi

           join students s
             on s.id =
                fi.student_id

           left join student_guardians sg
             on sg.student_id =
                s.id
            and sg.is_primary =
                1

           left join guardians g
             on g.id =
                sg.guardian_id

           where
             fi.id = ?

           limit 1`,
        )
        .bind(
          invoiceId,
        )
        .first<InvoiceRow>();

    if (
      !invoice
    ) {
      throw new ApiError(
        404,
        "Invoice not found.",
      );
    }

    if (
      [
        "paid",
        "cancelled",
        "waived",
      ].includes(
        invoice.status,
      )
    ) {
      throw new ApiError(
        409,
        `This invoice cannot be recorded as cash because its status is ${invoice.status}.`,
      );
    }

    const amountDue =
      Math.max(
        0,
        Number(
          invoice.amount_due_pence,
        ),
      );

    const alreadyPaid =
      Math.max(
        0,
        Number(
          invoice.amount_paid_pence,
        ),
      );

    const cashAmount =
      Math.max(
        0,
        amountDue -
          alreadyPaid,
      );

    if (
      cashAmount <
      1
    ) {
      throw new ApiError(
        409,
        "This invoice has no outstanding balance.",
      );
    }

    const transactionId =
      crypto.randomUUID();

    const allocationId =
      crypto.randomUUID();

    const receiptId =
      crypto.randomUUID();

    const providerReference =
      cashReference();

    const receiptNo =
      receiptNumber();

    const metadata =
      JSON.stringify({
        source:
          "admin_manual_cash_payment",

        recordedBy:
          who.id,

        note:
          note ||
          null,
      });

    await d1().batch([
      d1()
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
             ?, ?, ?, ?, 'cash',
             ?, ?, 'GBP',
             'fee_invoice',
             'paid',
             ?, ?
           )`,
        )
        .bind(
          transactionId,
          invoice.student_id,
          invoice.guardian_id,
          invoice.id,
          providerReference,
          cashAmount,
          paidAt,
          metadata,
        ),

      d1()
        .prepare(
          `insert into invoice_payment_allocations
             (
               id,
               invoice_id,
               transaction_id,
               amount_pence
             )

           values (
             ?, ?, ?, ?
           )`,
        )
        .bind(
          allocationId,
          invoice.id,
          transactionId,
          cashAmount,
        ),

      d1()
        .prepare(
          `update fee_invoices

           set
             amount_paid_pence =
               amount_due_pence,
             status =
               'paid',
             updated_at =
               CURRENT_TIMESTAMP

           where id = ?`,
        )
        .bind(
          invoice.id,
        ),

      d1()
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
             'fee_invoice',
             ?
           )`,
        )
        .bind(
          receiptId,
          receiptNo,
          transactionId,
          invoice.guardian_id,
          invoice.student_id,
          cashAmount,
          paidAt,
        ),
    ]);

    await audit(
      who,
      "record-cash-payment",
      "fee_invoices",
      invoice.id,
      {
        transactionId,
        receiptNumber:
          receiptNo,
        providerReference,
        studentId:
          invoice.student_id,
        studentNumber:
          invoice.student_number,
        studentName:
          invoice.student_name,
        amountPence:
          cashAmount,
        paymentDate:
          paidAt,
        note:
          note ||
          null,
      },
    );

    return json({
      ok: true,
      invoiceId:
        invoice.id,
      transactionId,
      amountPence:
        cashAmount,
      receiptNumber:
        receiptNo,
    });
  }
  catch (error) {
    return fail(
      error,
    );
  }
}