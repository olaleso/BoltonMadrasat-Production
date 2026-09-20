import { d1 } from "@/db";

type GoCardlessEvent = {
  id?: string;
  created_at?: string;
  resource_type?: string;
  action?: string;
  links?: {
    mandate?: string;
    new_mandate?: string;
    billing_request?: string;
    billing_request_flow?: string;
    customer?: string;
    customer_bank_account?: string;
    mandate_request_mandate?: string;
    payment?: string;
    [key: string]: string | undefined;
  };
  details?: {
    origin?: string;
    cause?: string;
    description?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, string>;
};

type WebhookPayload = {
  events?: GoCardlessEvent[];
};

type BillingRequestResponse = {
  billing_requests?: {
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    links?: {
      customer?: string;
      customer_bank_account?: string;
      mandate_request_mandate?: string;
      [key: string]: string | undefined;
    };
    mandate_request?: {
      links?: {
        mandate?: string;
        [key: string]: string | undefined;
      };
    };
  };
};

type BankAccountResponse = {
  customer_bank_accounts?: {
    id?: string;
    account_number_ending?: string;
    bank_name?: string;
  };
};

type DirectDebitRow = {
  id: string;
  guardian_id: string;
  provider_billing_request_id: string | null;
  provider_mandate_id: string | null;
  provider_customer_id: string | null;
  status: string;
  last4: string | null;
  bank_name: string | null;
};

type ExistingWebhookEvent = {
  id: string;
  status: string;
};

type PaymentTransactionRow = {
  id: string;
  invoice_id: string | null;
  student_id: string | null;
  guardian_id: string | null;
  provider_reference: string | null;
  amount_pence: number;
  currency: string;
  purpose: string;
  status: string;
  paid_at: string | null;
};

type InvoiceRow = {
  id: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  status: string;
};

type AllocationRow = {
  id: string;
  amount_pence: number;
};

type CountRow = {
  total_pence: number | null;
};


function gcBaseUrl() {
  return process.env.GOCARDLESS_ENVIRONMENT === "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

async function gcGet<T>(path: string): Promise<T> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;

  if (!token) {
    throw new Error("GoCardless access token is not configured.");
  }

  const response = await fetch(`${gcBaseUrl()}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "GoCardless-Version": "2015-07-06",
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let result: unknown = null;

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }

  if (!response.ok) {
    console.error(
      `GoCardless GET ${path} failed with ${response.status}:`,
      JSON.stringify(result, null, 2),
    );

    throw new Error(`GoCardless returned HTTP ${response.status}.`);
  }

  return result as T;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return bytesToHex(digest);
}

async function webhookSignature(rawBody: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );

  return bytesToHex(signature);
}

function safeEqual(left: string, right: string) {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();

  if (a.length != b.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

function normaliseStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\s-]+/g, "_");
}

function mandateStatusForAction(action: string) {
  switch (normaliseStatus(action)) {
    case "created":
    case "pending_submission":
      return "pending_submission";
    case "submitted":
      return "submitted";
    case "active":
    case "reinstated":
      return "active";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "consumed":
      return "consumed";
    default:
      return null;
  }
}

async function billingRequest(billingRequestId: string) {
  const response = await gcGet<BillingRequestResponse>(
    `/billing_requests/${billingRequestId}`,
  );

  return response.billing_requests ?? null;
}

async function safeBankSummary(bankAccountId: string | undefined) {
  if (!bankAccountId) {
    return {
      last4: null as string | null,
      bankName: null as string | null,
    };
  }

  try {
    const response = await gcGet<BankAccountResponse>(
      `/customer_bank_accounts/${bankAccountId}`,
    );

    return {
      last4: response.customer_bank_accounts?.account_number_ending ?? null,
      bankName: response.customer_bank_accounts?.bank_name ?? null,
    };
  } catch (error) {
    console.warn("Unable to retrieve GoCardless bank summary:", error);

    return {
      last4: null,
      bankName: null,
    };
  }
}

async function findMandateByBillingRequest(billingRequestId: string) {
  return d1()
    .prepare(
      `
      SELECT
        id,
        guardian_id,
        provider_billing_request_id,
        provider_mandate_id,
        provider_customer_id,
        status,
        last4,
        bank_name
      FROM direct_debit_mandates
      WHERE provider = 'gocardless'
        AND provider_billing_request_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
    .bind(billingRequestId)
    .first<DirectDebitRow>();
}

async function findMandateByProviderId(mandateId: string) {
  return d1()
    .prepare(
      `
      SELECT
        id,
        guardian_id,
        provider_billing_request_id,
        provider_mandate_id,
        provider_customer_id,
        status,
        last4,
        bank_name
      FROM direct_debit_mandates
      WHERE provider = 'gocardless'
        AND provider_mandate_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
    .bind(mandateId)
    .first<DirectDebitRow>();
}



async function findPaymentByProviderId(paymentId: string) {
  return d1()
    .prepare(
      `
      SELECT
        id,
        invoice_id,
        student_id,
        guardian_id,
        provider_reference,
        amount_pence,
        currency,
        purpose,
        status,
        paid_at
      FROM payment_transactions
      WHERE provider = 'gocardless'
        AND provider_reference = ?
      LIMIT 1
      `,
    )
    .bind(paymentId)
    .first<PaymentTransactionRow>();
}

async function findInvoice(invoiceId: string) {
  return d1()
    .prepare(
      `
      SELECT
        id,
        amount_due_pence,
        amount_paid_pence,
        status
      FROM fee_invoices
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(invoiceId)
    .first<InvoiceRow>();
}

async function allocationForTransaction(
  invoiceId: string,
  transactionId: string,
) {
  return d1()
    .prepare(
      `
      SELECT
        id,
        amount_pence
      FROM invoice_payment_allocations
      WHERE invoice_id = ?
        AND transaction_id = ?
      LIMIT 1
      `,
    )
    .bind(invoiceId, transactionId)
    .first<AllocationRow>();
}

async function allocatedTotalExcludingTransaction(
  invoiceId: string,
  transactionId: string,
) {
  const row = await d1()
    .prepare(
      `
      SELECT
        COALESCE(SUM(amount_pence), 0) AS total_pence
      FROM invoice_payment_allocations
      WHERE invoice_id = ?
        AND transaction_id <> ?
      `,
    )
    .bind(invoiceId, transactionId)
    .first<CountRow>();

  return Number(row?.total_pence ?? 0);
}

async function refreshInvoice(invoiceId: string) {
  const invoice = await findInvoice(invoiceId);

  if (!invoice) {
    return;
  }

  const row = await d1()
    .prepare(
      `
      SELECT
        COALESCE(SUM(amount_pence), 0) AS total_pence
      FROM invoice_payment_allocations
      WHERE invoice_id = ?
      `,
    )
    .bind(invoiceId)
    .first<CountRow>();

  const paid = Math.max(0, Number(row?.total_pence ?? 0));
  const due = Math.max(0, Number(invoice.amount_due_pence ?? 0));

  let status = "pending";

  if (["cancelled", "waived"].includes(normaliseStatus(invoice.status))) {
    status = invoice.status;
  } else if (due > 0 && paid >= due) {
    status = "paid";
  } else if (paid > 0) {
    status = "part_paid";
  }

  await d1()
    .prepare(
      `
      UPDATE fee_invoices
      SET
        amount_paid_pence = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    )
    .bind(paid, status, invoiceId)
    .run();
}

function receiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();

  return `GC-${date}-${suffix}`;
}

async function ensureReceipt(transaction: PaymentTransactionRow) {
  const existing = await d1()
    .prepare(
      `
      SELECT id
      FROM receipts
      WHERE transaction_id = ?
      LIMIT 1
      `,
    )
    .bind(transaction.id)
    .first<{ id: string }>();

  if (existing) {
    return;
  }

  await d1()
    .prepare(
      `
      INSERT INTO receipts
      (
        id,
        receipt_number,
        transaction_id,
        guardian_id,
        student_id,
        amount_pence,
        currency,
        purpose,
        issued_at,
        created_at,
        updated_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      `,
    )
    .bind(
      crypto.randomUUID(),
      receiptNumber(),
      transaction.id,
      transaction.guardian_id,
      transaction.student_id,
      Number(transaction.amount_pence),
      transaction.currency || "GBP",
      transaction.purpose || "fee_invoice",
    )
    .run();
}

async function ensurePaymentAllocation(transaction: PaymentTransactionRow) {
  const invoiceId = transaction.invoice_id;

  if (!invoiceId) {
    await ensureReceipt(transaction);
    return;
  }

  const invoice = await findInvoice(invoiceId);

  if (!invoice) {
    await ensureReceipt(transaction);
    return;
  }

  const existingAllocation = await allocationForTransaction(
    invoiceId,
    transaction.id,
  );

  if (!existingAllocation) {
    const invoiceStatus = normaliseStatus(invoice.status);

    if (!["cancelled", "waived"].includes(invoiceStatus)) {
      const alreadyAllocated = await allocatedTotalExcludingTransaction(
        invoiceId,
        transaction.id,
      );

      const remaining = Math.max(
        0,
        Number(invoice.amount_due_pence) - alreadyAllocated,
      );

      const amountToAllocate = Math.min(
        Math.max(0, Number(transaction.amount_pence)),
        remaining,
      );

      if (amountToAllocate > 0) {
        await d1()
          .prepare(
            `
            INSERT INTO invoice_payment_allocations
            (
              id,
              invoice_id,
              transaction_id,
              amount_pence,
              created_at,
              updated_at
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            `,
          )
          .bind(
            crypto.randomUUID(),
            invoiceId,
            transaction.id,
            amountToAllocate,
          )
          .run();
      }
    }
  }

  await ensureReceipt(transaction);
  await refreshInvoice(invoiceId);
}

async function reversePaymentAllocation(transaction: PaymentTransactionRow) {
  if (transaction.invoice_id) {
    await d1()
      .prepare(
        `
        DELETE FROM invoice_payment_allocations
        WHERE invoice_id = ?
          AND transaction_id = ?
        `,
      )
      .bind(transaction.invoice_id, transaction.id)
      .run();
  }

  /*
   * The current receipt table has no void/reversed status.
   * Remove the receipt when a payment ultimately fails or is charged
   * back so the portal never presents a failed collection as a valid
   * receipt. The payment transaction and webhook event remain as the
   * permanent audit trail.
   */
  await d1()
    .prepare(
      `
      DELETE FROM receipts
      WHERE transaction_id = ?
      `,
    )
    .bind(transaction.id)
    .run();

  if (transaction.invoice_id) {
    await refreshInvoice(transaction.invoice_id);
  }
}

async function updatePaymentTransaction(
  transactionId: string,
  status: string,
  options?: {
    markPaid?: boolean;
    clearPaidAt?: boolean;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
) {
  const markPaid = options?.markPaid === true;
  const clearPaidAt = options?.clearPaidAt === true;

  await d1()
    .prepare(
      `
      UPDATE payment_transactions
      SET
        status = ?,
        paid_at =
          CASE
            WHEN ? = 1
              THEN COALESCE(paid_at, CURRENT_TIMESTAMP)
            WHEN ? = 1
              THEN NULL
            ELSE paid_at
          END,
        failure_code = ?,
        failure_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    )
    .bind(
      status,
      markPaid ? 1 : 0,
      clearPaidAt ? 1 : 0,
      options?.failureCode ?? null,
      options?.failureMessage ?? null,
      transactionId,
    )
    .run();
}

async function processPaymentEvent(event: GoCardlessEvent) {
  const action = normaliseStatus(event.action);
  const paymentId = event.links?.payment;

  if (!paymentId) {
    return "ignored" as const;
  }

  const transaction = await findPaymentByProviderId(paymentId);

  /*
   * Ignore payments that were not created by this Madrasah application.
   * The webhook endpoint may receive other Sandbox/merchant activity.
   */
  if (!transaction) {
    return "ignored" as const;
  }

  const cause = event.details?.cause
    ? String(event.details.cause)
    : null;

  const description = event.details?.description
    ? String(event.details.description)
    : null;

  switch (action) {
    case "created":
    case "pending_submission":
      await updatePaymentTransaction(
        transaction.id,
        "pending_submission",
      );
      return "processed" as const;

    case "submitted":
    case "resubmitted":
      await updatePaymentTransaction(
        transaction.id,
        "submitted",
      );
      return "processed" as const;

    case "confirmed":
      await updatePaymentTransaction(
        transaction.id,
        "confirmed",
        {
          markPaid: true,
        },
      );

      await ensurePaymentAllocation(transaction);
      return "processed" as const;

    case "paid_out":
      await updatePaymentTransaction(
        transaction.id,
        "paid_out",
        {
          markPaid: true,
        },
      );

      /*
       * paid_out is later than confirmed. Re-run the idempotent financial
       * update in case the confirmed webhook was delayed or missed.
       */
      await ensurePaymentAllocation(transaction);
      return "processed" as const;

    case "failed":
      await updatePaymentTransaction(
        transaction.id,
        "failed",
        {
          clearPaidAt: true,
          failureCode: cause || "failed",
          failureMessage:
            description || "The Direct Debit payment failed.",
        },
      );

      await reversePaymentAllocation(transaction);
      return "processed" as const;

    case "cancelled":
      await updatePaymentTransaction(
        transaction.id,
        "cancelled",
        {
          clearPaidAt: true,
          failureCode: cause || "cancelled",
          failureMessage:
            description || "The Direct Debit payment was cancelled.",
        },
      );

      await reversePaymentAllocation(transaction);
      return "processed" as const;

    case "charged_back":
      await updatePaymentTransaction(
        transaction.id,
        "charged_back",
        {
          failureCode: cause || "charged_back",
          failureMessage:
            description || "The Direct Debit payment was charged back.",
        },
      );

      await reversePaymentAllocation(transaction);
      return "processed" as const;

    default:
      return "ignored" as const;
  }
}

async function setAgreementCollectionMethod(
  agreementId: string | undefined,
  method: "direct_debit" | "online",
) {
  if (!agreementId) {
    return;
  }

  await d1()
    .prepare(
      `
      UPDATE student_fee_agreements
      SET
        collection_method = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'active'
      `,
    )
    .bind(method, agreementId)
    .run();
}

async function resolveAgreementId(row: DirectDebitRow) {
  const billingRequestId = row.provider_billing_request_id;

  if (!billingRequestId) {
    return undefined;
  }

  const request = await billingRequest(billingRequestId);

  return request?.metadata?.agreement_id || undefined;
}

async function processBillingRequestEvent(event: GoCardlessEvent) {
  const action = normaliseStatus(event.action);

  if (action !== "fulfilled") {
    return "ignored" as const;
  }

  const billingRequestId = event.links?.billing_request;

  if (!billingRequestId) {
    return "ignored" as const;
  }

  const row = await findMandateByBillingRequest(billingRequestId);

  if (!row) {
    return "ignored" as const;
  }

  const request = await billingRequest(billingRequestId);

  const mandateId =
    event.links?.mandate_request_mandate ??
    request?.links?.mandate_request_mandate ??
    request?.mandate_request?.links?.mandate ??
    row.provider_mandate_id;

  const customerId =
    event.links?.customer ??
    request?.links?.customer ??
    row.provider_customer_id;

  const bankAccountId =
    event.links?.customer_bank_account ??
    request?.links?.customer_bank_account;

  const bank =
    row.last4 && row.bank_name
      ? {
          last4: row.last4,
          bankName: row.bank_name,
        }
      : await safeBankSummary(bankAccountId);

  await d1()
    .prepare(
      `
      UPDATE direct_debit_mandates
      SET
        provider_customer_id =
          COALESCE(?, provider_customer_id),
        provider_mandate_id =
          COALESCE(?, provider_mandate_id),
        status =
          CASE
            WHEN status IN (
              'submitted',
              'active',
              'failed',
              'cancelled',
              'expired',
              'consumed'
            )
            THEN status
            ELSE 'pending_submission'
          END,
        last4 =
          COALESCE(?, last4),
        bank_name =
          COALESCE(?, bank_name),
        updated_at =
          CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    )
    .bind(
      customerId,
      mandateId,
      bank.last4,
      bank.bankName,
      row.id,
    )
    .run();

  await setAgreementCollectionMethod(
    request?.metadata?.agreement_id,
    "direct_debit",
  );

  return "processed" as const;
}

async function processMandateEvent(event: GoCardlessEvent) {
  const action = normaliseStatus(event.action);
  const mandateId = event.links?.mandate;

  if (!mandateId) {
    return "ignored" as const;
  }

  const row = await findMandateByProviderId(mandateId);

  if (action === "replaced") {
    if (!row || !event.links?.new_mandate) {
      return "ignored" as const;
    }

    await d1()
      .prepare(
        `
        UPDATE direct_debit_mandates
        SET
          provider_mandate_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
      )
      .bind(event.links.new_mandate, row.id)
      .run();

    return "processed" as const;
  }

  const nextStatus = mandateStatusForAction(action);

  if (!nextStatus) {
    return "ignored" as const;
  }

  if (!row) {
    const billingRequestId = event.links?.billing_request;

    if (!billingRequestId) {
      return "ignored" as const;
    }

    const byBillingRequest = await findMandateByBillingRequest(
      billingRequestId,
    );

    if (!byBillingRequest) {
      return "ignored" as const;
    }

    await d1()
      .prepare(
        `
        UPDATE direct_debit_mandates
        SET
          provider_mandate_id = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
      )
      .bind(
        mandateId,
        nextStatus,
        byBillingRequest.id,
      )
      .run();

    return "processed" as const;
  }

  await d1()
    .prepare(
      `
      UPDATE direct_debit_mandates
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    )
    .bind(nextStatus, row.id)
    .run();

  if (nextStatus === "active") {
    const agreementId = await resolveAgreementId(row);

    await setAgreementCollectionMethod(
      agreementId,
      "direct_debit",
    );
  } else if (
    [
      "failed",
      "cancelled",
      "expired",
      "consumed",
    ].includes(nextStatus)
  ) {
    const agreementId = await resolveAgreementId(row);

    await setAgreementCollectionMethod(
      agreementId,
      "online",
    );
  }

  return "processed" as const;
}

async function processEvent(event: GoCardlessEvent) {
  switch (normaliseStatus(event.resource_type)) {
    case "billing_requests":
      return processBillingRequestEvent(event);
    case "mandates":
      return processMandateEvent(event);
    case "payments":
      return processPaymentEvent(event);
    default:
      return "ignored" as const;
  }
}

async function markEvent(
  id: string,
  status: "processed" | "ignored" | "failed",
  errorMessage?: string | null,
) {
  await d1()
    .prepare(
      `
      UPDATE payment_webhook_events
      SET
        status = ?,
        error_message = ?,
        processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
    )
    .bind(
      status,
      errorMessage ?? null,
      id,
    )
    .run();
}

export async function POST(request: Request) {
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;

  if (!secret) {
    console.error("GOCARDLESS_WEBHOOK_SECRET is not configured.");

    return new Response(
      "Webhook secret is not configured.",
      {
        status: 503,
      },
    );
  }

  const rawBody = await request.text();

  const signature = request.headers.get(
    "Webhook-Signature",
  );

  if (!signature) {
    return new Response(
      "Missing webhook signature.",
      {
        status: 401,
      },
    );
  }

  const expected = await webhookSignature(
    rawBody,
    secret,
  );

  if (!safeEqual(expected, signature)) {
    console.warn(
      "Rejected GoCardless webhook with invalid signature.",
    );

    return new Response(
      "Invalid webhook signature.",
      {
        status: 401,
      },
    );
  }

  let payload: WebhookPayload;

  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new Response(
      "Invalid JSON.",
      {
        status: 400,
      },
    );
  }

  const events = Array.isArray(payload.events)
    ? payload.events
    : [];

  const payloadHash = await sha256Hex(rawBody);

  try {
    for (const event of events) {
      const providerEventId = String(event.id ?? "").trim();

      if (!providerEventId) {
        continue;
      }

      const eventType = `${String(
        event.resource_type ?? "unknown",
      )}.${String(event.action ?? "unknown")}`;

      const existing = await d1()
        .prepare(
          `
          SELECT
            id,
            status
          FROM payment_webhook_events
          WHERE provider = 'gocardless'
            AND provider_event_id = ?
          LIMIT 1
          `,
        )
        .bind(providerEventId)
        .first<ExistingWebhookEvent>();

      if (
        existing &&
        [
          "processed",
          "ignored",
        ].includes(existing.status)
      ) {
        continue;
      }

      const eventRowId = existing?.id ?? crypto.randomUUID();

      if (!existing) {
        await d1()
          .prepare(
            `
            INSERT INTO payment_webhook_events
            (
              id,
              provider,
              provider_event_id,
              event_type,
              payload_hash,
              status,
              error_message,
              received_at,
              processed_at
            )
            VALUES
            (
              ?,
              'gocardless',
              ?,
              ?,
              ?,
              'received',
              NULL,
              CURRENT_TIMESTAMP,
              NULL
            )
            `,
          )
          .bind(
            eventRowId,
            providerEventId,
            eventType,
            payloadHash,
          )
          .run();
      } else {
        await d1()
          .prepare(
            `
            UPDATE payment_webhook_events
            SET
              event_type = ?,
              payload_hash = ?,
              status = 'received',
              error_message = NULL,
              received_at = CURRENT_TIMESTAMP,
              processed_at = NULL
            WHERE id = ?
            `,
          )
          .bind(
            eventType,
            payloadHash,
            eventRowId,
          )
          .run();
      }

      try {
        const outcome = await processEvent(event);

        await markEvent(
          eventRowId,
          outcome,
          null,
        );

        console.log(
          `GoCardless webhook ${providerEventId}: ${eventType} -> ${outcome}`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown webhook processing error";

        await markEvent(
          eventRowId,
          "failed",
          message,
        );

        throw error;
      }
    }

    return new Response(
      null,
      {
        status: 204,
      },
    );
  } catch (error) {
    console.error(
      "GoCardless webhook processing failed:",
      error,
    );

    return new Response(
      "Webhook processing failed.",
      {
        status: 500,
      },
    );
  }
}
