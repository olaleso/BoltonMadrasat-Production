import { d1 } from "@/db";

import {
  actor,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

type LetterRow = Record<string, unknown>;

export async function GET(
  request: Request,
) {
  try {
    const who =
      await actor(
        request,
        [
          "admin",
          "parent",
        ],
      );

    const url =
      new URL(
        request.url,
      );

    const applicationId =
      url.searchParams
        .get("id")
        ?.trim() ??
      "";

    const studentId =
      url.searchParams
        .get("studentId")
        ?.trim() ??
      "";

    if (
      !applicationId &&
      !studentId
    ) {
      throw new ApiError(
        400,
        "Application ID or student ID is required",
      );
    }

    const whereByReference =
      applicationId
        ? "a.id = ?"
        : "a.student_id = ?";

    const referenceValue =
      applicationId ||
      studentId;

    const parentRestriction =
      who.role === "parent"
        ? `
           and exists (
             select 1
             from student_guardians parent_sg
             join guardians parent_g
               on parent_g.id = parent_sg.guardian_id
             where parent_sg.student_id = s.id
               and parent_g.user_id = ?
           )`
        : "";

    const bindings:
      unknown[] = [
        referenceValue,
      ];

    if (
      who.role === "parent"
    ) {
      bindings.push(
        who.id,
      );
    }

    const row =
      await d1()
        .prepare(
          `select
             a.id
               as application_id,

             a.status
               as application_status,

             a.updated_at
               as accepted_at,

             s.student_number,

             s.first_name,

             s.last_name,

             s.first_name ||
             ' ' ||
             s.last_name
               as student_name,

             s.gender,

             g.full_name
               as guardian_name,

             g.email
               as guardian_email,

             g.phone
               as guardian_phone,

             e.enrolled_at,

             c.name
               as class_name,

             c.level
               as class_level,

             c.subject
               as class_subject,

             c.room
               as class_room,

             c.day_of_week
               as class_day_of_week,

             c.start_time,

             c.end_time,

             reviewer.display_name
               as accepted_by

           from applications a

           join students s
             on s.id =
                a.student_id

           left join student_guardians sg
             on sg.student_id =
                s.id
            and sg.is_primary =
                1

           left join guardians g
             on g.id =
                sg.guardian_id

           left join enrolments e
             on e.student_id =
                s.id
            and e.status =
                'active'

           left join classes c
             on c.id =
                e.class_id

           left join users reviewer
             on reviewer.id =
                a.reviewed_by

           where
             ${whereByReference}
             ${parentRestriction}

           order by
             case
               when a.status = 'accepted'
               then 0
               else 1
             end,
             e.enrolled_at desc,
             a.updated_at desc

           limit 1`,
        )
        .bind(
          ...bindings,
        )
        .first<LetterRow>();

    if (!row) {
      throw new ApiError(
        404,
        who.role === "parent"
          ? "Admission letter is not available for this student."
          : "Application not found",
      );
    }

    if (
      String(
        row.application_status ??
          "",
      ) !==
      "accepted"
    ) {
      throw new ApiError(
        409,
        "Admission letter is only available after the application has been accepted.",
      );
    }

    return json({
      ok: true,
      data: row,
    });
  }
  catch (error) {
    return fail(error);
  }
}
