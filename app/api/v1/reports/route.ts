import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
} from "@/lib/backend";

type Row =
  Record<
    string,
    unknown
  >;

async function all<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement =
    d1().prepare(
      query,
    );

  const result =
    bindings.length
      ? await statement
          .bind(
            ...bindings,
          )
          .all<T>()
      : await statement
          .all<T>();

  return result.results;
}

export async function GET(
  request: Request,
) {
  try {
    await actor(
      request,
      [
        "admin",
        "finance",
        "safeguarding",
      ],
    );

    const [
      allStudents,
      studentsByClass,
      missingGuardians,
      attendanceSummary,
      outstandingFees,
      staffAssignments,
    ] =
      await Promise.all([
        all(
          `select
             s.student_number,
             s.first_name,
             s.last_name,
             s.date_of_birth,
             s.gender,
             s.status,

             (
               select c.name
               from enrolments e
               join classes c
                 on c.id =
                    e.class_id
               where
                 e.student_id =
                   s.id
                 and e.status =
                   'active'
               order by
                 e.enrolled_at desc
               limit 1
             ) as class_name,

             g.full_name
               as guardian_name,
             g.email
               as guardian_email,
             g.phone
               as guardian_phone

           from students s

           left join student_guardians sg
             on sg.student_id =
                s.id
            and sg.is_primary =
                1

           left join guardians g
             on g.id =
                sg.guardian_id

           order by
             s.last_name,
             s.first_name`,
        ),

        all(
          `select
             c.name
               as class_name,
             s.student_number,
             s.first_name,
             s.last_name,
             s.gender,
             e.status
               as enrolment_status

           from enrolments e

           join students s
             on s.id =
                e.student_id

           join classes c
             on c.id =
                e.class_id

           where
             e.status =
               'active'

           order by
             c.name,
             s.last_name,
             s.first_name`,
        ),

        all(
          `select
             s.student_number,
             s.first_name,
             s.last_name,

             (
               select c.name
               from enrolments e
               join classes c
                 on c.id =
                    e.class_id
               where
                 e.student_id =
                   s.id
                 and e.status =
                   'active'
               limit 1
             ) as class_name

           from students s

           where
             s.status =
               'active'

             and not exists (
               select 1
               from student_guardians sg
               where
                 sg.student_id =
                   s.id
             )

           order by
             s.last_name,
             s.first_name`,
        ),

        all(
          `select
             c.name
               as class_name,

             a.status,

             count(*)
               as attendance_count

           from attendance a

           join classes c
             on c.id =
                a.class_id

           group by
             c.id,
             c.name,
             a.status

           order by
             c.name,
             a.status`,
        ),

        all(
          `select
             s.student_number,
             s.first_name,
             s.last_name,
             fi.description,
             fi.due_date,
             fi.amount_due_pence,
             fi.amount_paid_pence,

             (
               fi.amount_due_pence -
               fi.amount_paid_pence
             ) as balance_pence,

             fi.status

           from fee_invoices fi

           join students s
             on s.id =
                fi.student_id

           where
             (
               fi.amount_due_pence -
               fi.amount_paid_pence
             ) > 0

             and fi.status not in (
               'cancelled',
               'waived'
             )

           order by
             fi.due_date,
             s.last_name,
             s.first_name`,
        ),

        all(
          `select
             u.display_name
               as staff_name,
             u.email,

             group_concat(
               distinct ur.role
             ) as roles,

             group_concat(
               distinct c.name
             ) as assigned_classes,

             u.status

           from users u

           join user_roles ur
             on ur.user_id =
                u.id

           left join classes c
             on c.teacher_id =
                u.id

           where
             ur.role !=
               'parent'

           group by
             u.id

           order by
             u.display_name`,
        ),
      ]);

    return json({
      ok: true,

      reports: {
        all_students:
          allStudents,

        students_by_class:
          studentsByClass,

        missing_guardians:
          missingGuardians,

        attendance_summary:
          attendanceSummary,

        outstanding_fees:
          outstandingFees,

        staff_assignments:
          staffAssignments,
      },
    });
  }
  catch (error) {
    return fail(
      error,
    );
  }
}