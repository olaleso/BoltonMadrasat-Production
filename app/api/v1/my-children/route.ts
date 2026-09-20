import {
  actor,
  fail,
  json,
} from "@/lib/backend";

import {
  d1,
} from "@/db";

type ChildRow = Record<
  string,
  unknown
>;

export async function GET(
  request: Request,
) {
  try {
    const user =
      await actor(
        request,
        [
          "parent",
        ],
      );

    const db =
      d1();

    const result =
      await db
        .prepare(
          `
          SELECT
            s.id,
            s.student_number,
            s.first_name,
            s.last_name,
            TRIM(
              s.first_name || ' ' ||
              s.last_name
            ) AS name,
            s.date_of_birth,
            s.gender,
            s.status,

            (
              SELECT
                c.name

              FROM enrolments e

              INNER JOIN classes c
                ON c.id = e.class_id

              WHERE e.student_id = s.id
                AND e.status = 'active'

              ORDER BY
                e.enrolled_at DESC

              LIMIT 1
            ) AS class_name

          FROM guardians g

          INNER JOIN student_guardians sg
            ON sg.guardian_id = g.id

          INNER JOIN students s
            ON s.id = sg.student_id

          WHERE g.user_id = ?

          ORDER BY
            CASE
              WHEN s.status = 'active'
              THEN 0
              ELSE 1
            END,
            s.first_name ASC,
            s.last_name ASC
          `,
        )
        .bind(
          user.id,
        )
        .all<ChildRow>();

    return json({
      ok: true,
      data:
        result.results ??
        [],
    });
  } catch (
    error
  ) {
    console.error(
      "My children failed:",
      error,
    );

    return fail(
      error,
    );
  }
}
