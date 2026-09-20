import { env } from "cloudflare:workers";
import { hmacSha256Hex, timingSafeEqualHex } from "./crypto";

const apiBase = "https://api.gocardless.com";

async function gc(path: string, init: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GOCARDLESS_ACCESS_TOKEN}`,
      "GoCardless-Version": "2015-07-06",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const result = await response.json<any>();
  if (!response.ok) throw new Error(result?.error?.message ?? `GoCardless ${path} failed`);
  return result;
}

export async function createBacsMandateFlow(input: {
  redirectUri: string;
  exitUri: string;
}) {
  const request = await gc("/billing_requests", {
    method: "POST",
    body: JSON.stringify({
      billing_requests: {
        mandate_request: { currency: "GBP", scheme: "bacs" },
      },
    }),
  });
  const billingRequestId = request.billing_requests.id as string;

  const flow = await gc("/billing_request_flows", {
    method: "POST",
    body: JSON.stringify({
      billing_request_flows: {
        redirect_uri: input.redirectUri,
        exit_uri: input.exitUri,
        links: { billing_request: billingRequestId },
      },
    }),
  });

  return {
    billingRequestId,
    billingRequestFlowId: flow.billing_request_flows.id as string,
    authorisationUrl: flow.billing_request_flows.authorisation_url as string,
  };
}

export async function createGoCardlessPayment(input: {
  mandateId: string;
  amountPence: number;
  description: string;
  metadata: Record<string, string>;
}) {
  return gc("/payments", {
    method: "POST",
    body: JSON.stringify({
      payments: {
        amount: input.amountPence,
        currency: "GBP",
        description: input.description,
        metadata: input.metadata,
        links: { mandate: input.mandateId },
      },
    }),
  });
}

export async function verifyGoCardlessWebhook(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = await hmacSha256Hex(env.GOCARDLESS_WEBHOOK_SECRET, rawBody);
  return timingSafeEqualHex(expected, signature);
}
