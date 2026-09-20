import Stripe from "stripe";

import { d1 } from "@/db";

function stripeClient() {
  const secret =
    process.env.STRIPE_SECRET_KEY?.trim();

  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured",
    );
  }

  return new Stripe(secret, {
    httpClient:
      Stripe.createFetchHttpClient(),
  });
}

function receiptNumber() {
  const now =
    new Date();

  const stamp =
    now
      .toISOString()
      .replace(
        /[-:TZ.]/g,
        "",
      )
      .slice(
        0,
        14,
      );

  return `BM-${stamp}-${crypto
    .randomUUID()
    .slice(
      0,
      6,
    )
    .toUpperCase()}`;
}

async function sha256(
  value: string,
) {
  const bytes =
    new TextEncoder().encode(
      value,
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes,
    );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0",
          ),
    )
    .join("");
}

export async function POST(
  request: Request,
) {
  const stripe =
    stripeClient();

  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET
      ?.trim();

  if (
    !webhookSecret
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Stripe webhook secret is not configured",
      }),
      {
        status: 503,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  }

  const signature =
    request.headers.get(
      "stripe-signature",
    );

  if (!signature) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Missing Stripe signature",
      }),
      {
        status: 400,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  }

  /*
   * Important:
   * use the original raw body string.
   */
  const rawBody =
    await request.text();

  let event:
    Stripe.Event;

  try {
    event =
      await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
  } catch (
    error
  ) {
    console.error(
      "Stripe webhook signature verification failed",
      error,
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Invalid Stripe signature",
      }),
      {
        status: 400,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  }

  const db =
    d1();

  /*
   * Webhook event deduplication.
   */
  const existing =
    await db
      .prepare(
        `select
           id,
           status

         from payment_webhook_events

         where
           provider = 'stripe'
           and provider_event_id = ?

         limit 1`,
      )
      .bind(
        event.id,
      )
      .first<{
        id: string;
        status: string;
      }>();

  if (
    existing?.status ===
    "processed"
  ) {
    return new Response(
      JSON.stringify({
        received: true,
        duplicate: true,
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  }

  const webhookRowId =
    existing?.id ??
    crypto.randomUUID();

  const payloadHash =
    await sha256(
      rawBody,
    );

  if (!existing) {
    await db
      .prepare(
        `insert into payment_webhook_events
           (
             id,
             provider,
             provider_event_id,
             event_type,
             payload_hash,
             status
           )

         values (
           ?,
           'stripe',
           ?,
           ?,
           ?,
           'received'
         )`,
      )
      .bind(
        webhookRowId,
        event.id,
        event.type,
        payloadHash,
      )
      .run();
  }

  try {
    switch (
      event.type
    ) {
      case "checkout.session.completed": {
        const session =
          event.data
            .object as Stripe.Checkout.Session;

        /*
         * We only complete the transaction when
         * Stripe reports the Checkout payment
         * as actually paid.
         */
        if (
          session.payment_status !==
          "paid"
        ) {
          break;
        }

        const invoiceId =
          session.metadata
            ?.invoiceId ??
          session.client_reference_id;

        const transactionId =
          session.metadata
            ?.transactionId;

        if (
          !invoiceId ||
          !transactionId
        ) {
          throw new Error(
            "Checkout Session is missing invoice or transaction metadata",
          );
        }

        const transaction =
          await db
            .prepare(
              `select
                 pt.id,
                 pt.invoice_id,
                 pt.student_id,
                 pt.guardian_id,
                 pt.amount_pence,
                 pt.currency,
                 pt.status

               from payment_transactions pt

               where pt.id = ?

               limit 1`,
            )
            .bind(
              transactionId,
            )
            .first<{
              id: string;
              invoice_id:
                string | null;
              student_id:
                string | null;
              guardian_id:
                string | null;
              amount_pence:
                number;
              currency:
                string;
              status:
                string;
            }>();

        if (!transaction) {
          throw new Error(
            "Matching payment transaction was not found",
          );
        }

        /*
         * Idempotency:
         * if we already marked this transaction
         * paid, do not allocate it twice.
         */
        if (
          transaction.status ===
          "paid"
        ) {
          break;
        }

        const invoice =
          await db
            .prepare(
              `select
                 id,
                 student_id,
                 description,
                 amount_due_pence,
                 amount_paid_pence,
                 status

               from fee_invoices

               where id = ?

               limit 1`,
            )
            .bind(
              invoiceId,
            )
            .first<{
              id: string;
              student_id: string;
              description: string;
              amount_due_pence:
                number;
              amount_paid_pence:
                number;
              status: string;
            }>();

        if (!invoice) {
          throw new Error(
            "Matching invoice was not found",
          );
        }

        const amountPaid =
          Number(
            session.amount_total ??
              transaction.amount_pence,
          );

        if (
          amountPaid < 1
        ) {
          throw new Error(
            "Stripe returned an invalid payment amount",
          );
        }

        const previousPaid =
          Number(
            invoice.amount_paid_pence,
          );

        const amountDue =
          Number(
            invoice.amount_due_pence,
          );

        const newPaid =
          Math.min(
            amountDue,
            previousPaid +
              amountPaid,
          );

        const invoiceStatus =
          newPaid >=
          amountDue
            ? "paid"
            : "part_paid";

        const allocationId =
          crypto.randomUUID();

        const receiptId =
          crypto.randomUUID();

        const receiptNo =
          receiptNumber();

        const paidAt =
          new Date()
            .toISOString();

        /*
         * D1 batch keeps the core payment update
         * together.
         */
        await db.batch([
          db
            .prepare(
              `update payment_transactions

               set
                 provider_reference = ?,
                 provider_customer_id = ?,
                 status = 'paid',
                 paid_at = ?,
                 failure_code = null,
                 failure_message = null,
                 updated_at =
                   CURRENT_TIMESTAMP

               where id = ?`,
            )
            .bind(
              session.id,

              typeof session.customer ===
                "string"
                ? session.customer
                : session.customer?.id ??
                  null,

              paidAt,

              transactionId,
            ),

          db
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
               )

               on conflict (
                 invoice_id,
                 transaction_id
               )
               do nothing`,
            )
            .bind(
              allocationId,
              invoiceId,
              transactionId,
              amountPaid,
            ),

          db
            .prepare(
              `update fee_invoices

               set
                 amount_paid_pence = ?,
                 status = ?,
                 updated_at =
                   CURRENT_TIMESTAMP

               where id = ?`,
            )
            .bind(
              newPaid,
              invoiceStatus,
              invoiceId,
            ),

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
                   purpose
                 )

               values (
                 ?, ?, ?, ?, ?, ?,
                 ?, ?
               )

               on conflict (
                 transaction_id
               )
               do nothing`,
            )
            .bind(
              receiptId,
              receiptNo,
              transactionId,
              transaction.guardian_id,
              transaction.student_id,
              amountPaid,
              (
                transaction.currency ||
                "GBP"
              ).toUpperCase(),
              invoice.description,
            ),
        ]);

        break;
      }

      case "checkout.session.expired": {
        const session =
          event.data
            .object as Stripe.Checkout.Session;

        const transactionId =
          session.metadata
            ?.transactionId;

        if (
          transactionId
        ) {
          await db
            .prepare(
              `update payment_transactions

               set
                 status = 'expired',
                 failure_message =
                   'Stripe Checkout session expired before payment',
                 updated_at =
                   CURRENT_TIMESTAMP

               where id = ?
                 and status = 'pending'`,
            )
            .bind(
              transactionId,
            )
            .run();
        }

        break;
      }

      default:
        /*
         * We acknowledge other Stripe events
         * but do not mutate billing data.
         */
        break;
    }

    await db
      .prepare(
        `update payment_webhook_events

         set
           status = 'processed',
           processed_at =
             CURRENT_TIMESTAMP,
           error_message = null

         where id = ?`,
      )
      .bind(
        webhookRowId,
      )
      .run();

    return new Response(
      JSON.stringify({
        received: true,
      }),
      {
        status: 200,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown webhook processing error";

    console.error(
      "Stripe webhook processing error",
      error,
    );

    await db
      .prepare(
        `update payment_webhook_events

         set
           status = 'failed',
           error_message = ?

         where id = ?`,
      )
      .bind(
        message,
        webhookRowId,
      )
      .run();

    return new Response(
      JSON.stringify({
        received: false,
        error:
          message,
      }),
      {
        status: 500,
        headers: {
          "content-type":
            "application/json",
        },
      },
    );
  }
}