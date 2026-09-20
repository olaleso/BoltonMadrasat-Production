import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

async function allowedStudent(
  user: Awaited<ReturnType<typeof actor>>,
  studentId: string,
) {
  if (user.role === "admin" || user.role === "safeguarding") {
    return true;
  }

  if (user.role === "parent") {
    const row = await d1()
      .prepare(
        `select 1
         from student_guardians sg
         join guardians g
           on g.id = sg.guardian_id
         where sg.student_id = ?
           and g.user_id = ?
         limit 1`,
      )
      .bind(studentId, user.id)
      .first();

    return Boolean(row);
  }

  if (user.role === "teacher") {
    const row = await d1()
      .prepare(
        `select 1
         from enrolments e
         join classes c
           on c.id = e.class_id
         where e.student_id = ?
           and e.status = 'active'
           and c.teacher_id = ?
         limit 1`,
      )
      .bind(studentId, user.id)
      .first();

    return Boolean(row);
  }

  return false;
}

export async function GET(request: Request) {
  try {
    const who = await actor(
      request,
      ["admin", "teacher", "safeguarding", "parent"],
    );

    const url = new URL(request.url);
    const studentId = String(url.searchParams.get("id") ?? "").trim();

    if (!studentId) {
      throw new ApiError(400, "Student ID is required.");
    }

    if (!(await allowedStudent(who, studentId))) {
      throw new ApiError(403, "You do not have access to this student timeline.");
    }

    if (who.role === "teacher") {
      const teacherResult = await d1()
        .prepare(
          `select *
           from (
             select
               'student-created' as id,
               'registration' as event_type,
               'Student record created' as title,
               'Student profile was created in the Madrasah system.' as description,
               created_at as event_at,
               status as status
             from students
             where id = ?

             union all

             select
               'enrolment-' || e.id as id,
               'enrolment' as event_type,
               'Class enrolment' as title,
               'Enrolled in ' || coalesce(c.name, 'class') as description,
               coalesce(e.enrolled_at, e.created_at) as event_at,
               e.status as status
             from enrolments e
             join classes c
               on c.id = e.class_id
             where e.student_id = ?
               and c.teacher_id = ?

             union all

             select
               'attendance-' || a.id as id,
               'attendance' as event_type,
               'Attendance: ' || coalesce(a.status, 'recorded') as title,
               coalesce(c.name, 'Class') ||
                 case
                   when a.notes is not null and trim(a.notes) <> ''
                   then ' — ' || a.notes
                   else ''
                 end as description,
               a.session_date as event_at,
               a.status as status
             from attendance a
             join classes c
               on c.id = a.class_id
             where a.student_id = ?
               and c.teacher_id = ?

             union all

             select
               'progress-' || p.id as id,
               'learning-progress' as event_type,
               'Learning progress updated' as title,
               coalesce(p.strand, 'Learning') ||
                 case
                   when p.current_unit is not null and trim(p.current_unit) <> ''
                   then ': ' || p.current_unit
                   else ''
                 end as description,
               p.assessed_at as event_at,
               p.achievement as status
             from progress p
             join classes c
               on c.id = p.class_id
             where p.student_id = ?
               and c.teacher_id = ?
           ) events
           where event_at is not null
           order by datetime(event_at) desc, event_at desc
           limit 60`,
        )
        .bind(
          studentId,
          studentId,
          who.id,
          studentId,
          who.id,
          studentId,
          who.id,
        )
        .all<Record<string, unknown>>();

      return json({
        ok: true,
        data: teacherResult.results ?? [],
      });
    }

    const result = await d1()
      .prepare(
        `select *
         from (
           select
             'student-created' as id,
             'registration' as event_type,
             'Student record created' as title,
             'Student profile was created in the Madrasah system.' as description,
             created_at as event_at,
             status as status
           from students
           where id = ?

           union all

           select
             'application-' || a.id as id,
             'admission' as event_type,
             case
               when a.status = 'accepted' then 'Admission accepted'
               when a.status = 'rejected' then 'Application rejected'
               when a.status = 'waitlisted' then 'Application waitlisted'
               when a.status = 'under_review' then 'Application under review'
               else 'Application submitted'
             end as title,
             coalesce(a.review_notes, 'Admission application status updated.') as description,
             coalesce(a.accepted_at, a.submitted_at, a.created_at) as event_at,
             a.status as status
           from applications a
           where a.student_id = ?

           union all

           select
             'enrolment-' || e.id as id,
             'enrolment' as event_type,
             'Class enrolment' as title,
             'Enrolled in ' || coalesce(c.name, 'class') as description,
             coalesce(e.enrolled_at, e.created_at) as event_at,
             e.status as status
           from enrolments e
           left join classes c
             on c.id = e.class_id
           where e.student_id = ?

           union all

           select
             'attendance-' || a.id as id,
             'attendance' as event_type,
             'Attendance: ' || coalesce(a.status, 'recorded') as title,
             coalesce(c.name, 'Class') ||
               case
                 when a.notes is not null and trim(a.notes) <> ''
                 then ' — ' || a.notes
                 else ''
               end as description,
             a.session_date as event_at,
             a.status as status
           from attendance a
           left join classes c
             on c.id = a.class_id
           where a.student_id = ?

           union all

           select
             'progress-' || p.id as id,
             'learning-progress' as event_type,
             'Learning progress updated' as title,
             coalesce(p.strand, 'Learning') ||
               case
                 when p.current_unit is not null and trim(p.current_unit) <> ''
                 then ': ' || p.current_unit
                 else ''
               end as description,
             p.assessed_at as event_at,
             p.achievement as status
           from progress p
           where p.student_id = ?

           union all

           select
             'invoice-' || f.id as id,
             'invoice' as event_type,
             'Invoice created' as title,
             coalesce(f.description, 'Madrasah fee invoice') as description,
             coalesce(f.created_at, f.due_date) as event_at,
             f.status as status
           from fee_invoices f
           where f.student_id = ?
         ) events
         where event_at is not null
         order by datetime(event_at) desc, event_at desc
         limit 60`,
      )
      .bind(
        studentId,
        studentId,
        studentId,
        studentId,
        studentId,
        studentId,
      )
      .all<Record<string, unknown>>();

    return json({
      ok: true,
      data: result.results ?? [],
    });
  } catch (error) {
    return fail(error);
  }
}
