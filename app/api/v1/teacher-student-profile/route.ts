import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

async function all<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = d1().prepare(query);
  const result = bindings.length
    ? await statement.bind(...bindings).all<T>()
    : await statement.all<T>();

  return result.results ?? [];
}

async function first<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);

  return bindings.length
    ? await statement.bind(...bindings).first<T>()
    : await statement.first<T>();
}

export async function GET(request: Request) {
  try {
    const who = await actor(request, ["teacher"]);
    const url = new URL(request.url);
    const studentId = String(url.searchParams.get("id") ?? "").trim();

    if (!studentId) {
      throw new ApiError(400, "Student ID is required.");
    }

    const student = await first<Record<string, unknown>>(
      `select
         s.*,
         s.first_name || ' ' || s.last_name as name
       from students s
       where s.id = ?
         and s.status = 'active'
         and exists (
           select 1
           from enrolments e
           join classes c
             on c.id = e.class_id
           where e.student_id = s.id
             and e.status = 'active'
             and c.status = 'active'
             and c.teacher_id = ?
         )
       limit 1`,
      studentId,
      who.id,
    );

    if (!student) {
      throw new ApiError(
        403,
        "You can only open profiles for students actively enrolled in classes assigned to you.",
      );
    }

    const guardians = await all(
      `select
         g.id,
         g.full_name,
         g.email,
         g.phone,
         g.relationship,
         sg.is_primary,
         sg.authorised_collection
       from student_guardians sg
       join guardians g
         on g.id = sg.guardian_id
       where sg.student_id = ?
       order by
         sg.is_primary desc,
         g.full_name`,
      studentId,
    );

    const enrolments = await all(
      `select
         e.*,
         c.name as class_name,
         c.subject,
         c.level,
         c.room,
         c.day_of_week,
         c.start_time,
         c.end_time,
         u.display_name as teacher
       from enrolments e
       join classes c
         on c.id = e.class_id
       left join users u
         on u.id = c.teacher_id
       where e.student_id = ?
         and e.status = 'active'
         and c.status = 'active'
         and c.teacher_id = ?
       order by c.name`,
      studentId,
      who.id,
    );

    const attendance = await all(
      `select
         a.*,
         c.name as class_name
       from attendance a
       join classes c
         on c.id = a.class_id
       where a.student_id = ?
         and c.teacher_id = ?
       order by
         a.session_date desc,
         a.created_at desc
       limit 50`,
      studentId,
      who.id,
    );

    const progress = await all(
      `select
         p.*,
         c.name as class_name,
         u.display_name as recorded_by_name
       from progress p
       join classes c
         on c.id = p.class_id
       left join users u
         on u.id = p.recorded_by
       where p.student_id = ?
         and c.teacher_id = ?
       order by
         p.assessed_at desc,
         p.created_at desc
       limit 50`,
      studentId,
      who.id,
    );

    return json({
      ok: true,
      data: {
        student,
        guardians,
        enrolments,
        attendance,
        progress,
        agreements: [],
        invoices: [],
        directDebit: null,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
