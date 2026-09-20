import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
} from "@/lib/backend";

async function first<T = Record<string, unknown>>(
  query: string,
): Promise<T | null> {
  return d1()
    .prepare(query)
    .first<T>();
}

export async function GET(
  request: Request,
) {
  try {
    await actor(
      request,
      ["admin"],
    );

    const data =
      await first<{
        applicationsAwaitingReview: number;
        overdueInvoices: number;
        complianceDueSoon: number;
        classesAtCapacity: number;
        communicationFailures: number;
      }>(
        `select
           (
             select count(*)
             from applications
             where status in (
               'submitted',
               'under_review',
               'waitlisted'
             )
           ) as applicationsAwaitingReview,

           (
             select count(*)
             from fee_invoices
             where
               status in (
                 'pending',
                 'part_paid',
                 'overdue'
               )
               and date(due_date) < date('now')
               and amount_due_pence > amount_paid_pence
           ) as overdueInvoices,

           (
             select count(*)
             from compliance
             where
               expires_at is not null
               and date(expires_at) <= date('now', '+30 day')
           ) as complianceDueSoon,

           (
             select count(*)
             from classes c
             where
               c.status = 'active'
               and (
                 select count(*)
                 from enrolments e
                 where e.class_id = c.id
                   and e.status = 'active'
               ) >= c.capacity
           ) as classesAtCapacity,

           (
             select count(*)
             from communication_recipients
             where email_status = 'failed'
           ) as communicationFailures`,
      );

    const trendsResult = await d1()
      .prepare(
        `with recursive months(month_start, step) as (
           select date('now', 'start of month', '-5 months'), 0
           union all
           select date(month_start, '+1 month'), step + 1
           from months
           where step < 5
         )
         select
           strftime('%Y-%m', month_start) as month,
           (
             select count(*)
             from applications a
             where date(a.created_at) >= month_start
               and date(a.created_at) < date(month_start, '+1 month')
           ) as applications,
           (
             select coalesce(sum(pt.amount_pence), 0)
             from payment_transactions pt
             where lower(pt.status) in ('paid', 'confirmed', 'succeeded')
               and date(coalesce(pt.paid_at, pt.updated_at, pt.created_at)) >= month_start
               and date(coalesce(pt.paid_at, pt.updated_at, pt.created_at)) < date(month_start, '+1 month')
           ) as payments_pence,
           (
             select case
               when count(*) = 0 then 0
               else round(
                 100.0 * sum(case when lower(att.status) = 'present' then 1 else 0 end) / count(*),
                 1
               )
             end
             from attendance att
             where date(att.session_date) >= month_start
               and date(att.session_date) < date(month_start, '+1 month')
           ) as attendance_rate
         from months
         order by month_start`,
      )
      .all<Record<string, unknown>>();

    return json({
      ok: true,
      data: {
        ...(data ?? {
          applicationsAwaitingReview: 0,
          overdueInvoices: 0,
          complianceDueSoon: 0,
          classesAtCapacity: 0,
          communicationFailures: 0,
        }),
        trends: trendsResult.results ?? [],
      },
    });
  } catch (error) {
    return fail(error);
  }
}
