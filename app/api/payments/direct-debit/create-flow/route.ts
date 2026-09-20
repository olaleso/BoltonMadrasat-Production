import { eq } from "drizzle-orm";
import { db } from "@/db";
import { directDebitMandates, guardians } from "@/db/schema";
import { createBacsMandateFlow } from "@/lib/payments/gocardless";

// In the merged app, protect this route with the existing authenticated parent/admin session helper.
export async function POST(request: Request) {
  try {
    const { guardianId } = await request.json() as { guardianId?: string };
    if (!guardianId) return Response.json({ error: "guardianId is required" }, { status: 400 });

    const database = db();
    const guardian = await database.query.guardians.findFirst({ where: eq(guardians.id, guardianId) });
    if (!guardian) return Response.json({ error: "Guardian not found" }, { status: 404 });

    const origin = new URL(request.url).origin;
    const flow = await createBacsMandateFlow({
      redirectUri: `${origin}/portal?payment=direct-debit-complete`,
      exitUri: `${origin}/portal?payment=direct-debit-cancelled`,
    });

    await database.insert(directDebitMandates).values({
      id: crypto.randomUUID(),
      guardianId,
      provider: "gocardless",
      providerBillingRequestId: flow.billingRequestId,
      status: "pending",
      scheme: "bacs",
    });

    return Response.json({ authorisationUrl: flow.authorisationUrl, billingRequestFlowId: flow.billingRequestFlowId });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to start Direct Debit setup" }, { status: 500 });
  }
}
