import { sql } from "@/db";
import { actor, fail, json } from "@/lib/backend";
export async function GET(request: Request) {
  try {
    const who = await actor(request);
    if (who.role === "parent") {
      const rows = await sql`select
        (select count(distinct sg.student_id)::int from guardians g join student_guardians sg on sg.guardian_id=g.id where g.user_id=${who.id}) as "activeStudents",
        0::int as "openApplications",
        (select count(distinct e.class_id)::int from guardians g join student_guardians sg on sg.guardian_id=g.id join enrolments e on e.student_id=sg.student_id and e.status='active' where g.user_id=${who.id}) as "activeClasses",
        (select count(*)::int from guardians g join student_guardians sg on sg.guardian_id=g.id join attendance a on a.student_id=sg.student_id where g.user_id=${who.id} and a.session_date=current_date and a.status='present') as "presentToday",
        (select coalesce(sum(f.amount_pence-f.discount_pence-coalesce(p.paid,0)),0)::int from guardians g join student_guardians sg on sg.guardian_id=g.id join fees f on f.student_id=sg.student_id left join (select fee_id,sum(amount_pence) paid from payments group by fee_id) p on p.fee_id=f.id where g.user_id=${who.id} and f.status in ('due','overdue')) as "outstandingPence",
        0::int as "complianceDue"`;
      return json({ ok: true, summary: rows[0] });
    }
    const rows =
      await sql`select (select count(*)::int from students where status='active') as "activeStudents",(select count(*)::int from applications where status in ('submitted','review')) as "openApplications",(select count(*)::int from classes where status='active') as "activeClasses",(select count(*)::int from attendance where session_date=current_date and status='present') as "presentToday",(select coalesce(sum(amount_pence-discount_pence),0)::int from fees where status in ('due','overdue')) as "outstandingPence",(select count(*)::int from staff_compliance where status<>'valid' or expires_at<=current_date+30) as "complianceDue"`;
    return json({ ok: true, summary: rows[0] });
  } catch (error) {
    return fail(error);
  }
}
