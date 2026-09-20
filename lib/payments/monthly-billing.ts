import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  directDebitMandates,
  feeInvoices,
  paymentTransactions,
  studentFeeAgreements,
  studentGuardians,
} from "@/db/schema";
import { createGoCardlessPayment } from "./gocardless";

function isoDate(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(
    Math.min(day, last),
  ).padStart(2, "0")}`;
}

export async function generateMonthlyInvoices(now = new Date()) {
  const database = db();

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const today = now.toISOString().slice(0, 10);

  const agreements =
    await database.query.studentFeeAgreements.findMany({
      where: and(
        eq(studentFeeAgreements.status, "active"),
        lte(studentFeeAgreements.startsOn, today),
        or(
          isNull(studentFeeAgreements.endsOn),
          gte(studentFeeAgreements.endsOn, today),
        ),
      ),
    });

  let created = 0;

  for (const agreement of agreements) {
    const existing =
      await database.query.feeInvoices.findFirst({
        where: and(
          eq(feeInvoices.agreementId, agreement.id),
          eq(feeInvoices.billingYear, year),
          eq(feeInvoices.billingMonth, month),
        ),
      });

    if (existing) {
      continue;
    }

    const amountDuePence = Math.max(
      0,
      agreement.monthlyAmountPence - agreement.discountPence,
    );

    await database.insert(feeInvoices).values({
      id: crypto.randomUUID(),
      studentId: agreement.studentId,
      agreementId: agreement.id,
      billingYear: year,
      billingMonth: month,
      description: `${new Date(
        Date.UTC(year, month - 1, 1),
      ).toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })} Madrasah fee`,
      amountPence: agreement.monthlyAmountPence,
      discountPence: agreement.discountPence,
      amountDuePence,
      dueDate: isoDate(
        year,
        month,
        agreement.billingDay,
      ),
      status:
        amountDuePence === 0
          ? "waived"
          : "pending",
    });

    created++;
  }

  return {
    created,
    year,
    month,
  };
}

export async function queueDirectDebitForInvoice(
  invoiceId: string,
) {
  const database = db();

  const invoice =
    await database.query.feeInvoices.findFirst({
      where: eq(
        feeInvoices.id,
        invoiceId,
      ),
    });

  if (
    !invoice ||
    invoice.amountDuePence <= 0
  ) {
    return {
      skipped: true,
      reason: "No amount due",
    };
  }

  const relation =
    await database.query.studentGuardians.findFirst({
      where: eq(
        studentGuardians.studentId,
        invoice.studentId,
      ),
    });

  if (!relation) {
    return {
      skipped: true,
      reason: "No guardian link",
    };
  }

  const mandate =
    await database.query.directDebitMandates.findFirst({
      where: and(
        eq(
          directDebitMandates.guardianId,
          relation.guardianId,
        ),
        eq(
          directDebitMandates.status,
          "active",
        ),
      ),
    });

  if (!mandate?.providerMandateId) {
    return {
      skipped: true,
      reason: "No active Direct Debit mandate",
    };
  }

  const existing =
    await database.query.paymentTransactions.findFirst({
      where: and(
        eq(
          paymentTransactions.invoiceId,
          invoice.id,
        ),
        eq(
          paymentTransactions.provider,
          "gocardless",
        ),
      ),
    });

  if (existing) {
    return {
      skipped: true,
      reason: "Payment already created",
    };
  }

  const payment =
    await createGoCardlessPayment({
      mandateId:
        mandate.providerMandateId,
      amountPence:
        invoice.amountDuePence,
      description:
        invoice.description,
      metadata: {
        invoice_id:
          invoice.id,
        student_id:
          invoice.studentId,
      },
    });

  await database
    .insert(paymentTransactions)
    .values({
      id: crypto.randomUUID(),
      studentId:
        invoice.studentId,
      guardianId:
        relation.guardianId,
      invoiceId:
        invoice.id,
      provider:
        "gocardless",
      providerReference:
        payment.payments.id,
      amountPence:
        invoice.amountDuePence,
      currency:
        "GBP",
      purpose:
        "monthly_fee",
      status:
        payment.payments.status ??
        "pending",
    });

  await database
    .update(feeInvoices)
    .set({
      status:
        "collection_pending",
      updatedAt:
        new Date().toISOString(),
    })
    .where(
      eq(
        feeInvoices.id,
        invoice.id,
      ),
    );

  return {
    queued: true,
    paymentId:
      payment.payments.id,
  };
}