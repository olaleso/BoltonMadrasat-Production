import Stripe from "stripe";

import { d1 } from "@/db";
import {
  actor,
  body,
  fail,
  json,
  required,
  ApiError,
} from "@/lib/backend";

type Row = Record<string, unknown>;

async function first<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);

  return bindings.length
    ? await statement.bind(...bindings).first<T>()
    : await statement.first<T>();
}

function stripeClient() {
  const secret =
    process.env.STRIPE_SECRET_KEY?.trim();

  if (!secret) {
    throw new ApiError(
      503,
      "Stripe is not configured",
    );
  }

  return new Stripe(secret, {
    httpClient:
      Stripe.createFetchHttpClient(),
  });
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
          "parent",
        ],
      );

    const x =
      await body(request);

    const invoiceId =
      required(
        x.invoiceId,
        "Invoice",
      );

    const invoice =
      await first<{
        id: string;
        student_id: string;
        description: string;
        amount_due_pence: number;
        amount_paid_pence: number;
        status: string;
        student_name: string;
        guardian_id: string | null;
        guardian_email: string | null;
        parent_user_id: string | null;
      }>(
        `select
           fi.id,
           fi.student_id,
           fi.description,
           fi.amount_due_pence,
           fi.amount_paid_pence,
           fi.status,

           s.first_name || ' ' ||
           s.last_name
             as student_name,

           g.id
             as guardian_id,

           g.email
             as guardian_email,

           g.user_id
             as parent_user_id

         from fee_invoices fi

         join students s
           on s.id =
              fi.student_id

         left join student_guardians sg
           on sg.student_id =
              s.id
          and sg.is_primary = 1

         left join guardians g
           on g.id =
              sg.guardian_id

         where fi.id = ?

         limit 1`,
        invoiceId,
      );

    if (!invoice) {
      throw new ApiError(
        404,
        "Invoice not found",
      );
    }

    /*
     * A parent can only pay an invoice
     * belonging to their linked child.
     */
    if (
      who.role === "parent" &&
      invoice.parent_user_id !== who.id
    ) {
      throw new ApiError(
        403,
        "You cannot pay this invoice",
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
        `This invoice cannot be paid because its status is ${invoice.status}.`,
      );
    }

    const balancePence =
      Number(
        invoice.amount_due_pence,
      ) -
      Number(
        invoice.amount_paid_pence,
      );

    if (
      !Number.isInteger(
        balancePence,
      ) ||
      balancePence < 1
    ) {
      throw new ApiError(
        409,
        "This invoice has no outstanding balance",
      );
    }

    /*
     * Avoid creating multiple simultaneously
     * pending transactions for the same invoice.
     */
    const existingPending =
      await first<{
        id: string;
        provider_reference: string | null;
      }>(
        `select
           id,
           provider_reference

         from payment_transactions

         where
           invoice_id = ?
           and provider = 'stripe'
           and status = 'pending'

         order by created_at desc

         limit 1`,
        invoiceId,
      );

    const transactionId =
      existingPending?.id ??
      crypto.randomUUID();

    const baseUrl =
      new URL(
        request.url,
      ).origin;

    const stripe =
      stripeClient();

    const session =
      await stripe.checkout.sessions.create({
        mode:
          "payment",

        success_url:
          `${baseUrl}/portal?payment=success&session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${baseUrl}/portal?payment=cancelled`,

        client_reference_id:
          invoiceId,

        customer_email:
          invoice.guardian_email ??
          undefined,

        line_items: [
          {
            quantity: 1,

            price_data: {
              currency:
                "gbp",

              unit_amount:
                balancePence,

              product_data: {
                name:
                  invoice.description,

                description:
                  `Madrasah fee for ${invoice.student_name}`,
              },
            },
          },
        ],

        metadata: {
          invoiceId:
            invoice.id,

          transactionId,

          studentId:
            invoice.student_id,

          guardianId:
            invoice.guardian_id ??
            "",

          purpose:
            "fee_invoice",
        },

        payment_intent_data: {
          metadata: {
            invoiceId:
              invoice.id,

            transactionId,

            studentId:
              invoice.student_id,

            guardianId:
              invoice.guardian_id ??
              "",

            purpose:
              "fee_invoice",
          },
        },
      });

    if (!session.url) {
      throw new ApiError(
        500,
        "Stripe did not return a Checkout URL",
      );
    }

    const metadata =
      JSON.stringify({
        checkoutSessionId:
          session.id,

        invoiceId:
          invoice.id,

        studentId:
          invoice.student_id,

        guardianId:
          invoice.guardian_id,

        createdByUserId:
          who.id,
      });

    if (
      existingPending
    ) {
      await d1()
        .prepare(
          `update payment_transactions

           set
             provider_reference = ?,
             amount_pence = ?,
             currency = 'GBP',
             purpose = 'fee_invoice',
             status = 'pending',
             metadata_json = ?,
             updated_at =
               CURRENT_TIMESTAMP

           where id = ?`,
        )
        .bind(
          session.id,
          balancePence,
          metadata,
          transactionId,
        )
        .run();
    } else {
      await d1()
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
               metadata_json
             )

           values (
             ?, ?, ?, ?, 'stripe',
             ?, ?, 'GBP',
             'fee_invoice',
             'pending',
             ?
           )`,
        )
        .bind(
          transactionId,
          invoice.student_id,
          invoice.guardian_id,
          invoice.id,
          session.id,
          balancePence,
          metadata,
        )
        .run();
    }

    return json({
      ok: true,
      url:
        session.url,
      sessionId:
        session.id,
    });
  } catch (error) {
    return fail(error);
  }
}