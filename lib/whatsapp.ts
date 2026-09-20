import { env } from "cloudflare:workers";

type RuntimeEnv = {
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ADMIN_NUMBER_1?: string;
  WHATSAPP_ADMIN_NUMBER_2?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
};

const runtimeEnv =
  env as unknown as RuntimeEnv;

type NewApplicationAlert = {
  studentName: string;
  applicationNumber: string;
  age: string;
  gender: string;
  guardianPhone: string;
  portalUrl: string;
};

function cleanPhone(
  value: string | undefined,
) {
  return String(
    value ??
      "",
  )
    .replace(
      /\D/g,
      "",
    )
    .trim();
}

function bodyParameter(
  value: string,
) {
  return {
    type:
      "text",
    text:
      value,
  };
}

async function sendTemplate(
  recipient: string,
  input: NewApplicationAlert,
) {
  const accessToken =
    String(
      runtimeEnv.WHATSAPP_ACCESS_TOKEN ??
        "",
    ).trim();

  const phoneNumberId =
    String(
      runtimeEnv.WHATSAPP_PHONE_NUMBER_ID ??
        "",
    ).trim();

  const templateName =
    String(
      runtimeEnv.WHATSAPP_TEMPLATE_NAME ??
        "bnmc_new_application_alert",
    ).trim();

  const languageCode =
    String(
      runtimeEnv.WHATSAPP_TEMPLATE_LANGUAGE ??
        "en_GB",
    ).trim();

  if (
    !accessToken ||
    !phoneNumberId
  ) {
    return {
      skipped:
        true,
      recipient,
      reason:
        "WhatsApp Cloud API is not configured.",
    };
  }

  const response =
    await fetch(
      `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            messaging_product:
              "whatsapp",

            to:
              recipient,

            type:
              "template",

            template: {
              name:
                templateName,

              language: {
                code:
                  languageCode,
              },

              components: [
                {
                  type:
                    "body",

                  parameters: [
                    bodyParameter(
                      input.studentName,
                    ),

                    bodyParameter(
                      input.applicationNumber,
                    ),

                    bodyParameter(
                      input.age,
                    ),

                    bodyParameter(
                      input.gender,
                    ),

                    bodyParameter(
                      input.guardianPhone,
                    ),

                    bodyParameter(
                      input.portalUrl,
                    ),
                  ],
                },
              ],
            },
          }),
      },
    );

  const result =
    await response
      .json()
      .catch(
        () => ({}),
      ) as
        Record<
          string,
          unknown
        >;

  if (
    !response.ok
  ) {
    throw new Error(
      `WhatsApp delivery failed for ${recipient}: ${response.status} ${JSON.stringify(result)}`,
    );
  }

  return {
    skipped:
      false,
    recipient,
    result,
  };
}

export async function sendNewApplicationWhatsAppAlert(
  input: NewApplicationAlert,
) {
  const recipients =
    [
      cleanPhone(
        runtimeEnv.WHATSAPP_ADMIN_NUMBER_1,
      ),

      cleanPhone(
        runtimeEnv.WHATSAPP_ADMIN_NUMBER_2,
      ),
    ]
      .filter(
        Boolean,
      );

  if (
    recipients.length ===
    0
  ) {
    return {
      skipped:
        true,
      reason:
        "No WhatsApp admin numbers are configured.",
    };
  }

  const results =
    await Promise.allSettled(
      recipients.map(
        (recipient) =>
          sendTemplate(
            recipient,
            input,
          ),
      ),
    );

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
        "rejected"
      ) {
        console.error(
          "WhatsApp admin alert failed",
          recipients[
            index
          ],
          result.reason,
        );
      }
    },
  );

  return {
    skipped:
      false,
    attempted:
      recipients.length,
    results,
  };
}
