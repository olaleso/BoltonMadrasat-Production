import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET() {
  const summary = await env.DB.prepare(`
    SELECT
      (SELECT count(*) FROM students WHERE status='active') AS activeStudents,
      (SELECT count(*) FROM applications WHERE status IN ('submitted','under_review','waitlisted')) AS openApplications,
      (SELECT count(*) FROM classes WHERE status='active') AS activeClasses,
      (SELECT count(*) FROM attendance WHERE session_date=date('now') AND status='present') AS presentToday,
      COALESCE((SELECT sum(f.amount_pence - f.discount_pence - COALESCE(p.paid,0))
        FROM fees f LEFT JOIN (SELECT fee_id, sum(amount_pence) paid FROM payments GROUP BY fee_id) p ON p.fee_id=f.id
        WHERE f.status NOT IN ('cancelled','paid')), 0) AS outstandingPence,
      (SELECT count(*) FROM compliance WHERE expires_at IS NOT NULL AND date(expires_at) <= date('now','+30 day')) AS complianceDue
  `).first();

  return NextResponse.json({ summary });
}
