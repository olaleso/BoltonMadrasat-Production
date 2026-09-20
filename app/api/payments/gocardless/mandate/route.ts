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
  student_name: string;
  student_number: string;
  guardian_id: string;
  collection_method: string;
  status: string;
};

type GuardianRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
};

type ExistingMandateRow = {
  id: string;
  guardian_id: string;
  provider_customer_id:
    | string
    | null;
  provider_mandate_id:
    | string
    | null;
  provider_billing_request_id:
    | string
    | null;
  status: string;
};

type GoCardlessBillingRequestResponse = {
  billing_requests?: {
    id?: string;
    status?: string;
  };
};

type GoCardlessBillingRequestFlowResponse = {
  billing_request_flows?: {
    id?: string;
    authorisation_url?:
      | string
      | null;
  };
};

type GoCardlessApiError = {
  error?: {
    message?: string;

    errors?: Array<{
      message?: string;
      field?: string;
      request_pointer?: string;
      code?: string;
    }>;

    type?: string;
    code?: number;
    request_id?: string;
  };
};

function getGoCardlessBaseUrl() {
  return process.env
    .GOCARDLESS_ENVIRONMENT ===
    "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
}

async function gcRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
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
      `${getGoCardlessBaseUrl()}${path}`,
      {
        method:
          options.method ??
          "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "GoCardless-Version":
            "2015-07-06",

          Accept:
            "application/json",

          ...(options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),
        },

        ...(options.body
          ? {
              body:
                JSON.stringify(
                  options.body,
                ),
            }
          : {}),
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
    /*
     * Log the complete nested
     * validation response so Wrangler
     * does not collapse errors to
     * [Object].
     */
    console.error(
      `GoCardless API ${path} returned ${response.status}:`,
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    const gcError =
      result as
        GoCardlessApiError;

    const details =
      gcError.error
        ?.errors
        ?.map(
          (item) =>
            [
              item.field ??
                item.request_pointer,
              item.message,
            ]
              .filter(
                Boolean,
              )
              .join(
                ": ",
              ),
        )
        .filter(
          Boolean,
        )
        .join(
          "; ",
        );

    const message =
      details ||
      gcError.error
        ?.message ||
      `GoCardless returned HTTP ${response.status}.`;

    throw new Error(
      message,
    );
  }

  return result as T;
}

function splitName(
  fullName: string,
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return {
      givenName:
        "Guardian",

      familyName:
        "Guardian",
    };
  }

  if (
    parts.length === 1
  ) {
    return {
      givenName:
        parts[0],

      familyName:
        parts[0],
    };
  }

  return {
    givenName:
      parts[0],

    familyName:
      parts
        .slice(1)
        .join(" "),
  };
}

export async function POST(
  request: Request,
) {
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
      };

    const agreementId =
      String(
        input.agreementId ??
          "",
      ).trim();

    if (
      !agreementId
    ) {
      return json(
        {
          error:
            "Agreement ID is required.",
        },
        400,
      );
    }

    const db =
      d1();

    const agreement =
      await db
        .prepare(
          `
          SELECT
            a.id,
            a.student_id,

            TRIM(
              s.first_name || ' ' ||
              s.last_name
            ) AS student_name,

            s.student_number,
            sg.guardian_id,
            a.collection_method,
            a.status

          FROM student_fee_agreements a

          INNER JOIN students s
            ON s.id =
               a.student_id

          INNER JOIN student_guardians sg
            ON sg.student_id =
               a.student_id
           AND sg.is_primary = 1

          WHERE a.id = ?

          LIMIT 1
          `,
        )
        .bind(
          agreementId,
        )
        .first<AgreementRow>();

    if (
      !agreement
    ) {
      return json(
        {
          error:
            "Fee agreement was not found.",
        },
        404,
      );
    }

    if (
      agreement.status !==
      "active"
    ) {
      return json(
        {
          error:
            "Only active fee agreements can use Direct Debit.",
        },
        400,
      );
    }

    if (
      user.role ===
      "parent"
    ) {
      const guardianAccess =
        await db
          .prepare(
            `
            SELECT
              id

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
          .first<{
            id: string;
          }>();

      if (
        !guardianAccess
      ) {
        return json(
          {
            error:
              "You cannot manage Direct Debit for this student.",
          },
          403,
        );
      }
    }

    const guardian =
      await db
        .prepare(
          `
          SELECT
            id,
            user_id,
            full_name,
            email,
            phone

          FROM guardians

          WHERE id = ?

          LIMIT 1
          `,
        )
        .bind(
          agreement.guardian_id,
        )
        .first<GuardianRow>();

    if (
      !guardian
    ) {
      return json(
        {
          error:
            "Primary guardian was not found.",
        },
        404,
      );
    }

    const existing =
      await db
        .prepare(
          `
          SELECT
            id,
            guardian_id,
            provider_customer_id,
            provider_mandate_id,
            provider_billing_request_id,
            status

          FROM direct_debit_mandates

          WHERE guardian_id = ?
            AND provider =
                'gocardless'

          ORDER BY created_at DESC

          LIMIT 1
          `,
        )
        .bind(
          guardian.id,
        )
        .first<ExistingMandateRow>();

    if (
      existing &&
      existing.provider_mandate_id &&
      [
        "active",
        "submitted",
        "pending_submission",
      ].includes(
        existing.status,
      )
    ) {
      return json(
        {
          error:
            "An active Direct Debit mandate already exists for this guardian.",
        },
        409,
      );
    }

    /*
     * Current GoCardless Bacs examples
     * specify only the scheme.
     *
     * GoCardless automatically derives
     * the mandate currency as GBP.
     */
    const billingRequestResponse =
      await gcRequest<GoCardlessBillingRequestResponse>(
        "/billing_requests",
        {
          method:
            "POST",

          body: {
            billing_requests: {
              mandate_request: {
                scheme:
                  "bacs",
              },

              metadata: {
                guardian_id:
                  guardian.id,

                agreement_id:
                  agreement.id,

                student_id:
                  agreement.student_id,
              },
            },
          },
        },
      );

    const billingRequestId =
      billingRequestResponse
        .billing_requests
        ?.id;

    if (
      !billingRequestId
    ) {
      throw new Error(
        "GoCardless did not return a Billing Request ID.",
      );
    }

    const {
      givenName,
      familyName,
    } =
      splitName(
        guardian.full_name,
      );

    const origin =
      new URL(
        request.url,
      ).origin;

    const isLocal =
      origin.startsWith(
        "http://127.0.0.1",
      ) ||
      origin.startsWith(
        "http://localhost",
      );

    /*
     * GoCardless hosted flows are
     * designed around HTTPS return
     * URLs.
     *
     * During local development we
     * therefore omit redirect_uri and
     * exit_uri completely.
     *
     * Once deployed to the Cloudflare
     * HTTPS domain, both are included
     * automatically.
     */
    const flowSettings =
      isLocal
        ? {}
        : {
            redirect_uri:
              `${origin}/portal?direct_debit=success`,

            exit_uri:
              `${origin}/portal?direct_debit=cancelled`,
          };

    const flowResponse =
      await gcRequest<GoCardlessBillingRequestFlowResponse>(
        "/billing_request_flows",
        {
          method:
            "POST",

          body: {
            billing_request_flows: {
              ...flowSettings,

              links: {
                billing_request:
                  billingRequestId,
              },

              prefilled_customer: {
                given_name:
                  givenName,

                family_name:
                  familyName,

                email:
                  guardian.email,
              },
            },
          },
        },
      );

    const flow =
      flowResponse
        .billing_request_flows;

    if (
      !flow
        ?.authorisation_url
    ) {
      throw new Error(
        "GoCardless did not return an authorisation URL.",
      );
    }

    if (
      existing
    ) {
      await db
        .prepare(
          `
          UPDATE direct_debit_mandates

          SET
            provider_customer_id =
              NULL,

            provider_mandate_id =
              NULL,

            provider_billing_request_id =
              ?,

            status =
              'pending',

            scheme =
              'bacs',

            last4 =
              NULL,

            bank_name =
              NULL,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = ?
          `,
        )
        .bind(
          billingRequestId,
          existing.id,
        )
        .run();
    } else {
      await db
        .prepare(
          `
          INSERT INTO
            direct_debit_mandates
          (
            id,
            guardian_id,
            provider,
            provider_customer_id,
            provider_mandate_id,
            provider_billing_request_id,
            status,
            scheme,
            last4,
            bank_name,
            created_at,
            updated_at
          )

          VALUES
          (
            ?,
            ?,
            'gocardless',
            NULL,
            NULL,
            ?,
            'pending',
            'bacs',
            NULL,
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          `,
        )
        .bind(
          crypto.randomUUID(),
          guardian.id,
          billingRequestId,
        )
        .run();
    }

    return json({
      ok: true,

      url:
        flow.authorisation_url,

      billingRequestId,

      localDevelopment:
        isLocal,
    });
  } catch (
    error
  ) {
    console.error(
      "GoCardless mandate setup failed:",
      error,
    );

    return fail(
      error,
    );
  }
}