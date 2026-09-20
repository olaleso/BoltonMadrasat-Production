import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, guardians, paymentTransactions, studentGuardians } from "@/db/schema";
import { createStripeCheckout } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  try {
    const { applicationId } = await request.json() as { applicationId?: string };
    if (!applicationId) return Response.json({ error: "applicationId is required" }, { status: 400 });

    const database = db();
    const application = await database.query.applications.findFirst({
      where: eq(applications.id, applicationId),
    });
    if (!application) return Response.json({ error: "Application not found" }, { status: 404 });
    if (application.paymentStatus === "paid") {
      return Response.json({ error: "Application fee has already been paid" }, { status: 409 });
    }

    const relation = await database.query.studentGuardians.findFirst({
      where: eq(studentGuardians.studentId, application.studentId),
    });
    if (!relation) return Response.json({ error: "Primary guardian not found" }, { status: 409 });

    const guardian = await database.query.guardians.findFirst({
      where: eq(guardians.id, relation.guardianId),
    });
    if (!guardian) return Response.json({ error: "Guardian not found" }, { status: 409 });

    const origin = new URL(request.url).origin;
    const checkout = await createStripeCheckout({
      amountPence: application.applicationFeePence,
      applicationId: application.id,
      guardianEmail: guardian.email,
      successUrl: `${origin}/apply/payment-success?application=${encodeURIComponent(application.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/apply?application=${encodeURIComponent(application.id)}&payment=cancelled`,
    });

    await database.insert(paymentTransactions).values({
      id: crypto.randomUUID(),
      applicationId: application.id,
      studentId: application.studentId,
      guardianId: guardian.id,
      provider: "stripe",
      providerReference: checkout.id,
      providerCustomerId: checkout.customer ?? null,
      amountPence: application.applicationFeePence,
      currency: "GBP",
      purpose: "application_fee",
      status: "pending",
      metadataJson: JSON.stringify({ checkoutSessionId: checkout.id }),
    });

    return Response.json({ checkoutUrl: checkout.url, sessionId: checkout.id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to start payment" }, { status: 500 });
  }
}
