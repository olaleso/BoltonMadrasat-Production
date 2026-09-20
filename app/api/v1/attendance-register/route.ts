import { d1 } from "@/db";
import {
  actor,
  body,
  fail,
  json,
  required,
  ApiError,
} from "@/lib/backend";

async function all<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement =
    d1().prepare(query);

  const result =
    bindings.length
      ? await statement
          .bind(...bindings)
          .all<T>()
      : await statement
          .all<T>();

  return result.results;
}

async function first<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement =
    d1().prepare(query);

  return bindings.length
    ? await statement
        .bind(...bindings)
        .first<T>()
    : await statement
        .first<T>();
}

function checkDate(
  value: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(value)
  ) {
    throw new ApiError(
      400,
      "Session date must be in YYYY-MM-DD format",
    );
  }

  return value;
}

async function getClass(
  who: {
    id: string;
    role: string;
  },
  classId: string,
) {
  const row =
    await first<{
      id: string;
      name: string;
      teacher_id:
        string | null;
      status: string;
    }>(
      `select
         id,
         name,
         teacher_id,
         status
       from classes
       where id = ?
       limit 1`,
      classId,
    );

  if (!row) {
    throw new ApiError(
      404,
      "Class not found",
    );
  }

  if (
    row.status !==
    "active"
  ) {
    throw new ApiError(
      409,
      "This class is not active.",
    );
  }

  if (
    who.role ===
      "teacher" &&
    row.teacher_id !==
      who.id
  ) {
    throw new ApiError(
      403,
      "You can only take attendance for classes assigned to you.",
    );
  }

  return row;
}

export async function GET(
  request: Request,
) {
  try {
    const who =
      await actor(
        request,
        [
          "admin",
          "teacher",
        ],
      );

    const url =
      new URL(
        request.url,
      );

    const classId =
      url.searchParams
        .get(
          "classId",
        )
        ?.trim() ?? "";

    const sessionDate =
      url.searchParams
        .get(
          "sessionDate",
        )
        ?.trim() ?? "";

    const classes =
      who.role ===
      "teacher"
        ? await all(
            `select
               id,
               name,
               subject,
               level,
               room,
               day_of_week,
               start_time,
               end_time,
               capacity
             from classes
             where
               status = 'active'
               and teacher_id = ?
             order by name`,
            who.id,
          )
        : await all(
            `select
               id,
               name,
               subject,
               level,
               room,
               day_of_week,
               start_time,
               end_time,
               capacity
             from classes
             where
               status = 'active'
             order by name`,
          );

    if (!classId) {
      return json({
        ok: true,
        classes,
        students: [],
      });
    }

    await getClass(
      who,
      classId,
    );

    if (!sessionDate) {
      return json({
        ok: true,
        classes,
        students: [],
      });
    }

    checkDate(
      sessionDate,
    );

    const students =
      await all(
        `select
           s.id
             as student_id,

           s.student_number,

           s.first_name ||
           ' ' ||
           s.last_name
             as student_name,

           coalesce(
             a.status,
             'unmarked'
           ) as status

         from enrolments e

         join students s
           on s.id =
              e.student_id

         left join attendance a
           on a.student_id =
                s.id
          and a.class_id =
                e.class_id
          and a.session_date =
                ?

         where
           e.class_id = ?
           and e.status =
               'active'
           and s.status =
               'active'

         order by
           s.last_name,
           s.first_name`,
        sessionDate,
        classId,
      );

    return json({
      ok: true,
      classes,
      students,
    });
  }
  catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: Request,
) {
  try {
    const who =
      await actor(
        request,
        [
          "admin",
          "teacher",
        ],
      );

    const x =
      await body(
        request,
      );

    const action =
      required(
        x.action,
        "Action",
      );

    const classId =
      required(
        x.classId,
        "Class",
      );

    const sessionDate =
      checkDate(
        required(
          x.sessionDate,
          "Session date",
        ),
      );

    const classRow =
      await getClass(
        who,
        classId,
      );

    if (
      action ===
      "mark-all-present"
    ) {
      const students =
        await all<{
          student_id:
            string;
        }>(
          `select
             e.student_id

           from enrolments e

           join students s
             on s.id =
                e.student_id

           where
             e.class_id = ?
             and e.status =
                 'active'
             and s.status =
                 'active'`,
          classId,
        );

      if (
        students.length ===
        0
      ) {
        throw new ApiError(
          409,
          "There are no active students enrolled in this class.",
        );
      }

      const db =
        d1();

      const statements =
        students.map(
          (
            student,
          ) =>
            db.prepare(
              `insert into attendance
                 (
                   id,
                   student_id,
                   class_id,
                   session_date,
                   status
                 )
               values (
                 ?, ?, ?, ?,
                 'present'
               )

               on conflict (
                 student_id,
                 class_id,
                 session_date
               )

               do update set
                 status =
                   'present',
                 updated_at =
                   CURRENT_TIMESTAMP`,
            )
            .bind(
              crypto.randomUUID(),
              student.student_id,
              classId,
              sessionDate,
            ),
        );

      statements.push(
        db.prepare(
          `insert into audit_log
             (
               id,
               user_id,
               action,
               entity_type,
               entity_id,
               details
             )
           values (
             ?, ?, ?, ?, ?, ?
           )`,
        )
        .bind(
          crypto.randomUUID(),
          who.id,
          "attendance-mark-all-present",
          "classes",
          classId,
          JSON.stringify({
            className:
              classRow.name,

            sessionDate,

            studentCount:
              students.length,
          }),
        ),
      );

      await db.batch(
        statements,
      );

      return json({
        ok: true,

        updated:
          students.length,
      });
    }

    if (
      action ===
      "set-status"
    ) {
      const studentId =
        required(
          x.studentId,
          "Student",
        );

      const status =
        required(
          x.status,
          "Status",
        )
        .toLowerCase();

      const allowed = [
        "present",
        "absent",
        "late",
        "excused",
      ];

      if (
        !allowed.includes(
          status,
        )
      ) {
        throw new ApiError(
          400,
          "Invalid attendance status",
        );
      }

      const enrolment =
        await first(
          `select e.id
           from enrolments e
           join students s
             on s.id =
                e.student_id
           where
             e.student_id = ?
             and e.class_id = ?
             and e.status =
                 'active'
             and s.status =
                 'active'
           limit 1`,
          studentId,
          classId,
        );

      if (!enrolment) {
        throw new ApiError(
          409,
          "Student is not actively enrolled in this class.",
        );
      }

      const existing =
        await first<{
          id: string;
        }>(
          `select id
           from attendance
           where
             student_id = ?
             and class_id = ?
             and session_date = ?
           limit 1`,
          studentId,
          classId,
          sessionDate,
        );

      await d1()
        .prepare(
          `insert into attendance
             (
               id,
               student_id,
               class_id,
               session_date,
               status
             )
           values (
             ?, ?, ?, ?, ?
           )

           on conflict (
             student_id,
             class_id,
             session_date
           )

           do update set
             status =
               excluded.status,
             updated_at =
               CURRENT_TIMESTAMP`,
        )
        .bind(
          existing?.id ??
            crypto.randomUUID(),
          studentId,
          classId,
          sessionDate,
          status,
        )
        .run();

      return json({
        ok: true,
        status,
      });
    }

    throw new ApiError(
      400,
      "Unknown attendance action",
    );
  }
  catch (error) {
    return fail(error);
  }
}