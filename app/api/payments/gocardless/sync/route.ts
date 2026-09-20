import {
  actor,
  fail,
  json,
} from "@/lib/backend";

import {
  d1,
} from "@/db";

type AgreementRow = {
  id: string;
  student_id: string;
  guardian_id: string | null;
  collection_method: string;
  status: string;
};

type MandateRow = {
  id: string;
  guardian_id: string;
  provider_billing_request_id: string | null;
  provider_customer_id: string | null;
  provider_mandate_id: string | null;
  status: string;
  scheme: string;
  last4: string | null;
  bank_name: string | null;
  created_at: string;
  updated_at: string;
};

type BillingRequestResponse = {
  billing_requests?: {
    id?: string;
    status?: string;
    links?: {
      customer?: string;
      customer_bank_account?: string;
    };
    mandate_request?: {
      scheme?: string;
      links?: {
        mandate?: string;
      };
    };
  };
};

type MandateResponse = {
  mandates?: {
    id?: string;
    status?: string;
    scheme?: string;
    links?: {
      customer?: string;
      customer_bank_account?: string;
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

class GoCardlessRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(
    retryAfterSeconds: number,
  ) {
    super(
      "GoCardless rate limit reached.",
    );

    this.name =
      "GoCardlessRateLimitError";

    this.retryAfterSeconds =
      retryAfterSeconds;
  }
}

function baseUrl() {
  return process.env
    .GOCARDLESS_ENVIRONMENT ===
    "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

function normaliseStatus(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /[.\s-]+/g,
      "_",
    );
}

function secondsSince(
  value: string,
) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const iso =
    value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;

  const parsed =
    Date.parse(iso);

  if (
    Number.isNaN(parsed)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    0,
    (Date.now() - parsed) /
      1000,
  );
}

function retrySeconds(
  response: Response,
) {
  const raw =
    response.headers.get(
      "Retry-After",
    ) ??
    response.headers.get(
      "RateLimit-Reset",
    ) ??
    response.headers.get(
      "X-RateLimit-Reset",
    );

  const numeric =
    Number(raw);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    if (
      numeric > 1000000000
    ) {
      return Math.max(
        5,
        Math.ceil(
          numeric -
            Date.now() / 1000,
        ),
      );
    }

    return Math.max(
      5,
      Math.ceil(numeric),
    );
  }

  return 30;
}

async function gcGet<T>(
  path: string,
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
      `${baseUrl()}${path}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "GoCardless-Version":
            "2015-07-06",
          Accept:
            "application/json",
        },
      },
    );

  const text =
    await response.text();

  let result: unknown = null;

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }

  if (
    response.status === 429
  ) {
    throw new GoCardlessRateLimitError(
      retrySeconds(response),
    );
  }

  if (!response.ok) {
    console.error(
      `GoCardless GET ${path} failed:`,
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    throw new Error(
      `GoCardless returned HTTP ${response.status}.`,
    );
  }

  return result as T;
}

function cachedResponse(
  mandate: MandateRow,
  agreement: AgreementRow,
  extras?: {
    rateLimited?: boolean;
    retryAfterSeconds?: number;
  },
) {
  return {
    ok: true,
    cached: true,
    rateLimited:
      extras?.rateLimited ??
      false,
    retryAfterSeconds:
      extras?.retryAfterSeconds,
    billingRequestId:
      mandate
        .provider_billing_request_id,
    mandateId:
      mandate
        .provider_mandate_id,
    mandateStatus:
      mandate.status ||
      "pending",
    customerId:
      mandate
        .provider_customer_id,
    last4:
      mandate.last4,
    bankName:
      mandate.bank_name,
    collectionMethod:
      agreement
        .collection_method,
  };
}

export async function POST(
  request: Request,
) {
  let agreement:
    AgreementRow | null = null;

  let mandateRow:
    MandateRow | null = null;

  try {
    const user =
      await actor(
        request,
        [
          "admin",
          "finance",
          "parent",
        ],
      );

    const input =
      (await request.json()) as {
        agreementId?: string;
        force?: boolean;
      };

    const agreementId =
      String(
        input.agreementId ??
          "",
      ).trim();

    const force =
      input.force === true &&
      (
        user.role === "admin" ||
        user.role === "finance"
      );

    if (!agreementId) {
      return json(
        {
          error:
            "Agreement ID is required.",
        },
        400,
      );
    }

    const db = d1();

    agreement =
      await db
        .prepare(
          `
          SELECT
            a.id,
            a.student_id,
            a.collection_method,
            a.status,
            (
              SELECT sg.guardian_id
              FROM student_guardians sg
              WHERE sg.student_id =
                    a.student_id
              ORDER BY
                sg.is_primary DESC
              LIMIT 1
            ) AS guardian_id
          FROM student_fee_agreements a
          WHERE a.id = ?
          LIMIT 1
          `,
        )
        .bind(agreementId)
        .first<AgreementRow>();

    if (!agreement) {
      return json(
        {
          error:
            "Fee agreement was not found.",
        },
        404,
      );
    }

    if (!agreement.guardian_id) {
      return json(
        {
          error:
            "No guardian is linked to this student.",
        },
        404,
      );
    }

    if (
      user.role === "parent"
    ) {
      const guardianAccess =
        await db
          .prepare(
            `
            SELECT id
            FROM guardians
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
            `,
          )
          .bind(
            agreement.guardian_id,
            user.id,
          )
          .first<{ id: string }>();

      if (!guardianAccess) {
        return json(
          {
            error:
              "You cannot manage Direct Debit for this student.",
          },
          403,
        );
      }
    }

    mandateRow =
      await db
        .prepare(
          `
          SELECT
            id,
            guardian_id,
            provider_billing_request_id,
            provider_customer_id,
            provider_mandate_id,
            status,
            scheme,
            last4,
            bank_name,
            created_at,
            updated_at
          FROM direct_debit_mandates
          WHERE guardian_id = ?
            AND provider = 'gocardless'
          ORDER BY created_at DESC
          LIMIT 1
          `,
        )
        .bind(
          agreement.guardian_id,
        )
        .first<MandateRow>();

    if (!mandateRow) {
      return json(
        {
          error:
            "No GoCardless Direct Debit setup has been started for this agreement.",
        },
        404,
      );
    }

    const savedStatus =
      normaliseStatus(
        mandateRow.status,
      );

    const pendingStatus =
      [
        "",
        "pending",
        "checking",
        "pending_submission",
        "submitted",
      ].includes(savedStatus);

    /*
     * Normal page loads use D1. Only pending mandates are refreshed
     * automatically, and at most once every 15 seconds. Stable states
     * are expected to be maintained by GoCardless webhooks.
     */
    if (
      !force &&
      (
        !pendingStatus ||
        secondsSince(
          mandateRow.updated_at,
        ) < 15
      )
    ) {
      return json(
        cachedResponse(
          mandateRow,
          agreement,
        ),
      );
    }

    let billingRequestStatus:
      string | undefined;

    let customerId =
      mandateRow
        .provider_customer_id;

    let mandateId =
      mandateRow
        .provider_mandate_id;

    let mandateStatus =
      savedStatus ||
      "pending";

    let bankAccountId:
      string | null = null;

    /*
     * Once we already know the mandate ID, retrieve the mandate directly
     * instead of repeatedly retrieving the Billing Request as well.
     */
    if (!mandateId) {
      const billingRequestId =
        mandateRow
          .provider_billing_request_id;

      if (!billingRequestId) {
        return json(
          cachedResponse(
            mandateRow,
            agreement,
          ),
        );
      }

      const billingResponse =
        await gcGet<
          BillingRequestResponse
        >(
          `/billing_requests/${billingRequestId}`,
        );

      const billingRequest =
        billingResponse
          .billing_requests;

      if (!billingRequest) {
        throw new Error(
          "GoCardless did not return the Billing Request.",
        );
      }

      billingRequestStatus =
        normaliseStatus(
          billingRequest.status,
        );

      customerId =
        billingRequest.links
          ?.customer ??
        customerId;

      mandateId =
        billingRequest
          .mandate_request
          ?.links
          ?.mandate ??
        mandateId;

      bankAccountId =
        billingRequest.links
          ?.customer_bank_account ??
        null;

      if (!mandateId) {
        mandateStatus =
          billingRequestStatus ||
          mandateStatus;
      }
    }

    if (mandateId) {
      const mandateResponse =
        await gcGet<
          MandateResponse
        >(
          `/mandates/${mandateId}`,
        );

      const mandate =
        mandateResponse
          .mandates;

      if (mandate) {
        mandateStatus =
          normaliseStatus(
            mandate.status ??
              mandateStatus,
          );

        customerId =
          mandate.links
            ?.customer ??
          customerId;

        bankAccountId =
          mandate.links
            ?.customer_bank_account ??
          bankAccountId;
      }
    }

    let last4 =
      mandateRow.last4;

    let bankName =
      mandateRow.bank_name;

    /*
     * Bank name / last digits are optional display data. Do not retrieve
     * them repeatedly once already saved.
     */
    if (
      bankAccountId &&
      (!last4 || !bankName)
    ) {
      try {
        const bankResponse =
          await gcGet<
            BankAccountResponse
          >(
            `/customer_bank_accounts/${bankAccountId}`,
          );

        last4 =
          bankResponse
            .customer_bank_accounts
            ?.account_number_ending ??
          last4;

        bankName =
          bankResponse
            .customer_bank_accounts
            ?.bank_name ??
          bankName;
      } catch (error) {
        if (
          !(error instanceof
            GoCardlessRateLimitError)
        ) {
          console.warn(
            "Unable to retrieve GoCardless bank account summary:",
            error,
          );
        }
      }
    }

    await db
      .prepare(
        `
        UPDATE direct_debit_mandates
        SET
          provider_customer_id =
            COALESCE(?, provider_customer_id),
          provider_mandate_id =
            COALESCE(?, provider_mandate_id),
          status = ?,
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
        mandateStatus,
        last4,
        bankName,
        mandateRow.id,
      )
      .run();

    const usableMandate =
      Boolean(mandateId) &&
      [
        "pending_submission",
        "submitted",
        "active",
      ].includes(
        mandateStatus,
      );

    if (
      usableMandate &&
      agreement.collection_method !==
        "direct_debit"
    ) {
      await db
        .prepare(
          `
          UPDATE student_fee_agreements
          SET
            collection_method =
              'direct_debit',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
          `,
        )
        .bind(agreement.id)
        .run();

      agreement = {
        ...agreement,
        collection_method:
          "direct_debit",
      };
    }

    return json({
      ok: true,
      cached: false,
      billingRequestId:
        mandateRow
          .provider_billing_request_id,
      billingRequestStatus,
      mandateId,
      mandateStatus,
      customerId,
      last4,
      bankName,
      collectionMethod:
        agreement.collection_method,
    });
  } catch (error) {
    if (
      error instanceof
        GoCardlessRateLimitError &&
      agreement &&
      mandateRow
    ) {
      console.warn(
        `GoCardless rate limit reached. Using cached mandate state for ${error.retryAfterSeconds}s.`,
      );

      return json(
        cachedResponse(
          mandateRow,
          agreement,
          {
            rateLimited: true,
            retryAfterSeconds:
              error.retryAfterSeconds,
          },
        ),
      );
    }

    console.error(
      "GoCardless mandate sync failed:",
      error,
    );

    return fail(error);
  }
}
