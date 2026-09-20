"use client";

import { useEffect, useState } from "react";
import { FileText, Landmark } from "lucide-react";
import styles from "./student-admission-payment-card.module.css";

type Props = {
  studentId: string;
  role: string;
};

const bank = {
  accountName: "BOLTON NIGERIAN MUSLIM COMMUNITY",
  bankName: "Lloyds",
  sortCode: "30-99-50",
  accountNumber: "79650763",
  reference: "Madrasah",
};

export default function StudentAdmissionPaymentCard({ studentId, role }: Props) {
  const [letterAvailable, setLetterAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!studentId || !["admin", "parent"].includes(role)) return;

    let mounted = true;
    fetch(`/api/v1/admission-letter?studentId=${encodeURIComponent(studentId)}`, {
      cache: "no-store",
    })
      .then((response) => {
        if (mounted) setLetterAvailable(response.ok);
      })
      .catch(() => {
        if (mounted) setLetterAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, [studentId, role]);

  if (!["admin", "parent"].includes(role)) return null;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.heading}>
          <Landmark />
          <div>
            <h3>Bank transfer / Standing order</h3>
            <p>Parents may pay by bank transfer or arrange a standing order using the details below.</p>
          </div>
        </div>

        <dl className={styles.details}>
          <div><dt>Account name</dt><dd>{bank.accountName}</dd></div>
          <div><dt>Bank</dt><dd>{bank.bankName}</dd></div>
          <div><dt>Sort code</dt><dd>{bank.sortCode}</dd></div>
          <div><dt>Account number</dt><dd>{bank.accountNumber}</dd></div>
          <div><dt>Payment reference</dt><dd>{bank.reference}</dd></div>
        </dl>

        <p className={styles.note}>
          Please use <strong>{bank.reference}</strong> as the payment reference so BNMC can identify the payment correctly.
        </p>
      </section>

      <section className={styles.card}>
        <div className={styles.heading}>
          <FileText />
          <div>
            <h3>Admission letter</h3>
            <p>View or save the student&apos;s BNMC admission letter.</p>
          </div>
        </div>

        <button
          type="button"
          className={styles.action}
          disabled={letterAvailable !== true}
          onClick={() => window.location.assign(`/portal/admission-letter?studentId=${encodeURIComponent(studentId)}`)}
        >
          <FileText />
          {letterAvailable === null
            ? "Checking admission letter..."
            : letterAvailable
              ? "View admission letter"
              : "Admission letter not available"}
        </button>
      </section>
    </>
  );
}
