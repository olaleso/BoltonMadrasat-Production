import {
  actor,
  fail,
  json,
} from "@/lib/backend";

import {
  d1,
} from "@/db";

type InvoiceRow = {
  id: string;
  agreement_id: string;
  student_id: string;
  guardian_id: string;
  description: string;
  currency: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  balance_pence: number;
  status: string;
};

type MandateRow = {
  id: string;
  guardian_id: string;
  provider_mandate_id:
    | string
    | null;
  provider_customer_id:
    | string
    | null;
  status: string;
};

type ExistingTransactionRow = {
  id: string;
  provider_reference:
    | string
    | null;
  status: string;
};

type PaymentCreateResponse = {
  payments?: {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    charge_date?: string;
    created_at?: string;

    links?: {
      mandate?: string;
      creditor?: string;
    };
  };
};

type GoCardlessApiError = {
  error?: {
    message?: string;

    errors?: Array<{
      message?: string;
      field?: string;
      request_pointer?: string;
      reason?: string;
    }>;

    code?: number;
    request_id?: string;
    type?: string;
  };
};

function gcBaseUrl() {
  return process.env
    .GOCARDLESS_ENVIRONMENT ===
    "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

async function gcPost<T>(
  path: string,
  payload: unknown,
  idempotencyKey: string,
): Promise<T> {
  const token =
    process.env
      .GOCARDLESS_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "GoCardless access token is not configured.",
    );
  }

  const response =
    await fetch(
      `${gcBaseUrl()}${path}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "GoCardless-Version":
            "2015-07-06",

          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          "Idempotency-Key":
            idempotencyKey,
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  const text =
    await response.text();

  let result:
    unknown = null;

  if (text) {
    try {
      result =
        JSON.parse(
          text,
        );
    } catch {
      result =
        text;
    }
  }

  if (!response.ok) {
    console.error(
      `GoCardless POST ${path} returned ${response.status}:`,
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    const apiError =
      result as
        GoCardlessApiError;

    const details =
      apiError.error
        ?.errors
        ?.map(
          (item) =>
            [
              item.field ??
                item.request_pointer,
              item.message ??
                item.reason,
            ]
              .filter(Boolean)
              .join(": "),
        )
        .filter(Boolean)
        .join("; ");

    throw new Error(
      details ||
      apiError.error
        ?.message ||
      `GoCardless returned HTTP ${response.status}.`,
    );
  }

  return result as T;
}

function normaliseStatus(
  value: unknown,
) {
  return String(
    value ??
      "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /[.\s-]+/g,
      "_",
    );
}

export async function POST(
  request: Request,
) {
  try {
    /*
     * Parents can still pay individual invoices using Stripe.
     * Direct Debit collection itself is an administrative/automated
     * operation and should not be manually initiated by parents.
     */
    await actor(
      request,
      [
        "admin",
        "finance",
      ],
    );

    const input =
      (await request.json()) as {
        invoiceId?: string;
      };

    const invoiceId =
      String(
        input.invoiceId ??
          "",
      ).trim();

    if (!invoiceId) {
      return json(
        {
          error:
            "Invoice ID is required.",
        },
        400,
      );
    }

    const db =
      d1();

    const invoice =
      await db
        .prepare(
          `
          SELECT
            i.id,
            i.agreement_id,
            i.student_id,
            i.description,

            COALESCE(
              fp.currency,
              'GBP'
            ) AS currency,

            i.amount_due_pence,
            i.amount_paid_pence,

            (
              i.amount_due_pence -
              i.amount_paid_pence
            ) AS balance_pence,

            i.status,

            (
              SELECT sg.guardian_id
              FROM student_guardians sg
              WHERE sg.student_id =
                    i.student_id
              ORDER BY
                sg.is_primary DESC
              LIMIT 1
            ) AS guardian_id

          FROM fee_invoices i

          LEFT JOIN
            student_fee_agreements a
            ON a.id =
               i.agreement_id

          LEFT JOIN
            fee_plans fp
            ON fp.id =
               a.fee_plan_id

          WHERE i.id = ?

          LIMIT 1
          `,
        )
        .bind(
          invoiceId,
        )
        .first<InvoiceRow>();

    if (!invoice) {
      return json(
        {
          error:
            "Invoice was not found.",
        },
        404,
      );
    }

    const invoiceStatus =
      normaliseStatus(
        invoice.status,
      );

    if (
      [
        "paid",
        "cancelled",
        "waived",
      ].includes(
        invoiceStatus,
      ) ||
      Number(
        invoice.balance_pence,
      ) <= 0
    ) {
      return json(
        {
          error:
            "This invoice has no outstanding balance to collect.",
        },
        409,
      );
    }

    if (
      !invoice.guardian_id
    ) {
      return json(
        {
          error:
            "The student does not have a guardian available for Direct Debit collection.",
        },
        409,
      );
    }

    /*
     * Never create another GoCardless collection while an earlier
     * attempt for the same invoice is still in a live/successful state.
     */
    const existing =
      await db
        .prepare(
          `
          SELECT
            id,
            provider_reference,
            status

          FROM payment_transactions

          WHERE invoice_id = ?
            AND provider =
                'gocardless'

          ORDER BY
            created_at DESC

          LIMIT 1
          `,
        )
        .bind(
          invoice.id,
        )
        .first<ExistingTransactionRow>();

    if (
      existing &&
      ![
        "failed",
        "cancelled",
        "charged_back",
      ].includes(
        normaliseStatus(
          existing.status,
        ),
      )
    ) {
      return json(
        {
          error:
            "A Direct Debit collection already exists for this invoice.",

          transactionId:
            existing.id,

          paymentId:
            existing.provider_reference,

          status:
            existing.status,
        },
        409,
      );
    }

    /*
     * GoCardless allows payments to be created against a submitted
     * mandate as well as an active mandate. For a submitted mandate,
     * GoCardless schedules the payment for the earliest valid charge
     * date. We deliberately do not collect while the mandate is only
     * pending_submission.
     */
    const mandate =
      await db
        .prepare(
          `
          SELECT
            id,
            guardian_id,
            provider_mandate_id,
            provider_customer_id,
            status

          FROM direct_debit_mandates

          WHERE guardian_id = ?
            AND provider =
                'gocardless'

          ORDER BY
            created_at DESC

          LIMIT 1
          `,
        )
        .bind(
          invoice.guardian_id,
        )
        .first<MandateRow>();

    if (
      !mandate ||
      !mandate
        .provider_mandate_id
    ) {
      return json(
        {
          error:
            "No Direct Debit mandate has been set up for this guardian.",
        },
        409,
      );
    }

    const mandateStatus =
      normaliseStatus(
        mandate.status,
      );

    if (
      ![
        "submitted",
        "active",
      ].includes(
        mandateStatus,
      )
    ) {
      return json(
        {
          error:
            `Direct Debit cannot be collected yet. The mandate is currently ${String(
              mandate.status ||
                "pending",
            ).replaceAll(
              "_",
              " ",
            )}.`,
          mandateStatus:
            mandate.status,
        },
        409,
      );
    }

    const attemptResult =
      await db
        .prepare(
          `
          SELECT COUNT(*) AS attempt_count

          FROM payment_transactions

          WHERE invoice_id = ?
            AND provider =
                'gocardless'
          `,
        )
        .bind(
          invoice.id,
        )
        .first<{
          attempt_count:
            number;
        }>();

    const attemptNumber =
      Number(
        attemptResult
          ?.attempt_count ??
          0,
      ) + 1;

    /*
     * GoCardless supports idempotency keys on payment creation.
     * Including the invoice and attempt number prevents a double-click
     * from creating duplicate collections while still allowing a later
     * deliberate retry after a failed/cancelled payment.
     */
    const idempotencyKey =
      `madrasat-${invoice.id}-attempt-${attemptNumber}`;

    const paymentResponse =
      await gcPost<PaymentCreateResponse>(
        "/payments",
        {
          payments: {
            amount:
              Number(
                invoice.balance_pence,
              ),

            currency:
              String(
                invoice.currency ||
                  "GBP",
              ),

            links: {
              mandate:
                mandate
                  .provider_mandate_id,
            },

            metadata: {
              invoice_id:
                invoice.id,

              agreement_id:
                invoice
                  .agreement_id,

              student_id:
                invoice
                  .student_id,

              guardian_id:
                invoice
                  .guardian_id,

              attempt:
                String(
                  attemptNumber,
                ),
            },
          },
        },
        idempotencyKey,
      );

    const payment =
      paymentResponse
        .payments;

    const paymentId =
      payment?.id;

    if (!paymentId) {
      throw new Error(
        "GoCardless did not return a payment ID.",
      );
    }

    const transactionId =
      crypto.randomUUID();

    const providerStatus =
      normaliseStatus(
        payment.status ??
          "pending_submission",
      );

    await db
      .prepare(
        `
        INSERT INTO
          payment_transactions
        (
          id,
          application_id,
          student_id,
          guardian_id,
          invoice_id,
          provider,
          provider_reference,
          provider_customer_id,
          amount_pence,
          currency,
          purpose,
          status,
          initiated_at,
          paid_at,
          failure_code,
          failure_message,
          metadata_json,
          created_at,
          updated_at
        )

        VALUES
        (
          ?,
          NULL,
          ?,
          ?,
          ?,
          'gocardless',
          ?,
          ?,
          ?,
          ?,
          'fee_invoice',
          ?,
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          NULL,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        `,
      )
      .bind(
        transactionId,
        invoice.student_id,
        invoice.guardian_id,
        invoice.id,
        paymentId,
        mandate
          .provider_customer_id,
        Number(
          invoice.balance_pence,
        ),
        String(
          payment.currency ??
            invoice.currency ??
            "GBP",
        ),
        providerStatus,
        JSON.stringify({
          mandateId:
            mandate
              .provider_mandate_id,

          chargeDate:
            payment
              .charge_date ??
            null,

          agreementId:
            invoice
              .agreement_id,

          attempt:
            attemptNumber,
        }),
      )
      .run();

    return json(
      {
        ok: true,

        transactionId,

        paymentId,

        status:
          providerStatus,

        chargeDate:
          payment
            .charge_date ??
          null,

        amountPence:
          Number(
            payment.amount ??
              invoice
                .balance_pence,
          ),

        currency:
          payment
            .currency ??
          invoice.currency ??
          "GBP",
      },
      201,
    );
  } catch (
    error
  ) {
    console.error(
      "GoCardless collection creation failed:",
      error,
    );

    return fail(
      error,
    );
  }
}
