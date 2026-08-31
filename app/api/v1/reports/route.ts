import { sql } from "@/db";
import { actor, fail, json } from "@/lib/backend";
export async function GET(request: Request) {
  try {
    await actor(request, ["admin", "finance", "safeguarding"]);
    const [attendance, fees, progress, capacity] = await Promise.all([
      sql`select status,count(*)::int as count from attendance group by status order by status`,
      sql`select status,count(*)::int as count,coalesce(sum(amount_pence-discount_pence),0)::int as total_pence from fees group by status order by status`,
      sql`select strand,round(avg(score),1) as average_score,count(*)::int as assessments from progress group by strand order by strand`,
      sql`select c.name,c.capacity,count(e.id)::int as enrolled from classes c left join enrolments e on e.class_id=c.id and e.status='active' group by c.id order by c.name`,
    ]);
    return json({
      ok: true,
      reports: { attendance, fees, progress, capacity },
    });
  } catch (error) {
    return fail(error);
  }
}
