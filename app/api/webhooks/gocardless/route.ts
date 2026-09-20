import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { directDebitMandates, paymentTransactions, paymentWebhookEvents } from "@/db/schema";
import { verifyGoCardlessWebhook } from "@/lib/payments/gocardless";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("Webhook-Signature");
  if (!(await verifyGoCardlessWebhook(rawBody, signature))) {
    return new Response("Invalid signature", { status: 498 });
  }

  const payload = JSON.parse(rawBody) as any;
  const events = Array.isArray(payload.events) ? payload.events : [];
  const database = db();

  for (const event of events) {
    const duplicate = await database.query.paymentWebhookEvents.findFirst({
      where: and(
        eq(paymentWebhookEvents.provider, "gocardless"),
        eq(paymentWebhookEvents.providerEventId, event.id),
      ),
    });
    if (duplicate) continue;

    await database.insert(paymentWebhookEvents).values({
      id: crypto.randomUUID(),
      provider: "gocardless",
      providerEventId: event.id,
      eventType: `${event.resource_type}.${event.action}`,
      status: "received",
    });

    try {
      if (event.resource_type === "mandates") {
        const mandateId = event.links?.mandate as string | undefined;
        if (mandateId) {
          const status = event.action === "active" || event.action === "activated"
            ? "active"
            : event.action === "cancelled"
              ? "cancelled"
              : event.action === "failed"
                ? "failed"
                : event.action;
          await database.update(directDebitMandates)
            .set({ status, providerMandateId: mandateId, updatedAt: new Date().toISOString() })
            .where(eq(directDebitMandates.providerMandateId, mandateId));
        }
      }

      if (event.resource_type === "payments") {
        const paymentId = event.links?.payment as string | undefined;
        if (paymentId) {
          const status = ["confirmed", "paid_out"].includes(event.action)
            ? "paid"
            : ["failed", "cancelled", "charged_back"].includes(event.action)
              ? "failed"
              : event.action;
          await database.update(paymentTransactions)
            .set({
              status,
              paidAt: status === "paid" ? new Date().toISOString() : null,
              failureMessage: status === "failed" ? event.action : null,
              updatedAt: new Date().toISOString(),
            })
            .where(and(
              eq(paymentTransactions.provider, "gocardless"),
              eq(paymentTransactions.providerReference, paymentId),
            ));
        }
      }

      await database.update(paymentWebhookEvents)
        .set({ status: "processed", processedAt: new Date().toISOString() })
        .where(and(
          eq(paymentWebhookEvents.provider, "gocardless"),
          eq(paymentWebhookEvents.providerEventId, event.id),
        ));
    } catch (error) {
      await database.update(paymentWebhookEvents)
        .set({ status: "failed", errorMessage: String(error), processedAt: new Date().toISOString() })
        .where(and(
          eq(paymentWebhookEvents.provider, "gocardless"),
          eq(paymentWebhookEvents.providerEventId, event.id),
        ));
      console.error(error);
    }
  }

  return Response.json({ received: true });
}
