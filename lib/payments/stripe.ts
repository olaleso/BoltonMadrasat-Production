import { env } from "cloudflare:workers";
import { hmacSha256Hex, timingSafeEqualHex } from "./crypto";

export async function createStripeCheckout(input: {
  amountPence: number;
  applicationId: string;
  guardianEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("customer_email", input.guardianEmail);
  body.set("line_items[0][price_data][currency]", "gbp");
  body.set("line_items[0][price_data][product_data][name]", "BNMC Madrasah application fee");
  body.set("line_items[0][price_data][unit_amount]", String(input.amountPence));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[application_id]", input.applicationId);
  body.set("payment_intent_data[metadata][application_id]", input.applicationId);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const result = await response.json<any>();
  if (!response.ok) throw new Error(result?.error?.message ?? "Stripe checkout creation failed");
  return result;
}

export async function verifyStripeWebhook(rawBody: string, header: string | null) {
  if (!header) return false;
  const parts = header.split(",").map((x) => x.trim());
  const timestamp = parts.find((x) => x.startsWith("t="))?.slice(2);
  const signatures = parts.filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = await hmacSha256Hex(env.STRIPE_WEBHOOK_SECRET, `${timestamp}.${rawBody}`);
  return signatures.some((sig) => timingSafeEqualHex(expected, sig));
}
