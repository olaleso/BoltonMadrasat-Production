import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, paymentTransactions, paymentWebhookEvents, receipts } from "@/db/schema";
import { verifyStripeWebhook } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!(await verifyStripeWebhook(rawBody, signature))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody) as any;
  const database = db();

  const existing = await database.query.paymentWebhookEvents.findFirst({
    where: and(
      eq(paymentWebhookEvents.provider, "stripe"),
      eq(paymentWebhookEvents.providerEventId, event.id),
    ),
  });
  if (existing) return Response.json({ received: true, duplicate: true });

  await database.insert(paymentWebhookEvents).values({
    id: crypto.randomUUID(),
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    status: "received",
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const applicationId = session.metadata?.application_id as string | undefined;
      const transaction = await database.query.paymentTransactions.findFirst({
        where: and(
          eq(paymentTransactions.provider, "stripe"),
          eq(paymentTransactions.providerReference, session.id),
        ),
      });

      if (transaction && session.payment_status === "paid") {
        const paidAmount = Number(session.amount_total ?? 0);
        if (paidAmount !== transaction.amountPence || String(session.currency).toUpperCase() !== "GBP") {
          throw new Error("Stripe amount/currency mismatch");
        }

        await database.update(paymentTransactions)
          .set({ status: "paid", paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
          .where(eq(paymentTransactions.id, transaction.id));

        if (applicationId) {
          await database.update(applications)
            .set({
              status: "submitted",
              paymentStatus: "paid",
              submittedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(applications.id, applicationId));
        }

        const receiptNumber = `BNM-${new Date().getUTCFullYear()}-${transaction.id.slice(0, 8).toUpperCase()}`;
        await database.insert(receipts).values({
          id: crypto.randomUUID(),
          receiptNumber,
          transactionId: transaction.id,
          guardianId: transaction.guardianId,
          studentId: transaction.studentId,
          amountPence: transaction.amountPence,
          currency: "GBP",
          purpose: "Application fee",
        }).onConflictDoNothing();
      }
    }

    await database.update(paymentWebhookEvents)
      .set({ status: "processed", processedAt: new Date().toISOString() })
      .where(and(
        eq(paymentWebhookEvents.provider, "stripe"),
        eq(paymentWebhookEvents.providerEventId, event.id),
      ));

    return Response.json({ received: true });
  } catch (error) {
    await database.update(paymentWebhookEvents)
      .set({ status: "failed", errorMessage: String(error), processedAt: new Date().toISOString() })
      .where(and(
        eq(paymentWebhookEvents.provider, "stripe"),
        eq(paymentWebhookEvents.providerEventId, event.id),
      ));
    console.error(error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
