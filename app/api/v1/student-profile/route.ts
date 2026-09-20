import {
  actor,
  audit,
  body,
  boolean,
  fail,
  json,
  optional,
  required,
  ApiError,
} from "@/lib/backend";

import {
  d1,
} from "@/db";

type DbRow = Record<
  string,
  unknown
>;

type StatementLike = {
  all<T>(): Promise<{
    results?: T[];
  }>;
};

async function allRows(
  statement: StatementLike,
) {
  const result =
    await statement.all<DbRow>();

  return result.results ?? [];
}

export async function GET(
  request: Request,
) {
  try {
    const user =
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

    const studentId =
      String(
        url.searchParams.get(
          "id",
        ) ?? "",
      ).trim();

    if (!studentId) {
      return json(
        {
          error:
            "Student ID is required.",
        },
        400,
      );
    }

    const db = d1();

    if (
      user.role ===
      "parent"
    ) {
      const access =
        await db
          .prepare(
            `
            SELECT
              s.id

            FROM students s

            INNER JOIN student_guardians sg
              ON sg.student_id = s.id

            INNER JOIN guardians g
              ON g.id = sg.guardian_id

            WHERE s.id = ?
              AND g.user_id = ?

            LIMIT 1
            `,
          )
          .bind(
            studentId,
            user.id,
          )
          .first<{
            id: string;
          }>();

      if (!access) {
        return json(
          {
            error:
              "You cannot view this student profile.",
          },
          403,
        );
      }
    }

    const student =
      await db
        .prepare(
          `
          SELECT *
          FROM students
          WHERE id = ?
          LIMIT 1
          `,
        )
        .bind(
          studentId,
        )
        .first<DbRow>();

    if (!student) {
      return json(
        {
          error:
            "Student was not found.",
        },
        404,
      );
    }

    const [
      guardians,
      enrolments,
      attendance,
      progress,
      agreements,
      invoices,
    ] =
      await Promise.all([
        allRows(
          db
            .prepare(
              `
              SELECT
                g.*,
                sg.is_primary

              FROM student_guardians sg

              INNER JOIN guardians g
                ON g.id = sg.guardian_id

              WHERE sg.student_id = ?

              ORDER BY
                sg.is_primary DESC,
                g.full_name ASC
              `,
            )
            .bind(
              studentId,
            ),
        ),

        allRows(
          db
            .prepare(
              `
              SELECT
                e.*,
                c.name AS class_name,
                c.subject,
                c.level,
                c.room

              FROM enrolments e

              INNER JOIN classes c
                ON c.id = e.class_id

              WHERE e.student_id = ?

              ORDER BY
                CASE
                  WHEN e.status = 'active'
                  THEN 0
                  ELSE 1
                END,
                e.enrolled_at DESC
              `,
            )
            .bind(
              studentId,
            ),
        ),

        allRows(
          db
            .prepare(
              `
              SELECT
                a.*,
                c.name AS class_name

              FROM attendance a

              LEFT JOIN classes c
                ON c.id = a.class_id

              WHERE a.student_id = ?

              ORDER BY
                a.session_date DESC

              LIMIT 30
              `,
            )
            .bind(
              studentId,
            ),
        ),

        allRows(
          db
            .prepare(
              `
              SELECT
                p.*,
                c.name AS class_name

              FROM progress p

              LEFT JOIN classes c
                ON c.id = p.class_id

              WHERE p.student_id = ?

              ORDER BY
                p.assessed_at DESC

              LIMIT 30
              `,
            )
            .bind(
              studentId,
            ),
        ),

        allRows(
          db
            .prepare(
              `
              SELECT
                a.*,
                fp.name AS fee_plan_name,
                fp.amount_pence AS fee_plan_amount_pence

              FROM student_fee_agreements a

              LEFT JOIN fee_plans fp
                ON fp.id = a.fee_plan_id

              WHERE a.student_id = ?

              ORDER BY
                CASE
                  WHEN a.status = 'active'
                  THEN 0
                  ELSE 1
                END,
                a.created_at DESC
              `,
            )
            .bind(
              studentId,
            ),
        ),

        allRows(
          db
            .prepare(
              `
              SELECT
                i.*,
                (
                  COALESCE(
                    i.amount_due_pence,
                    0
                  ) -
                  COALESCE(
                    i.amount_paid_pence,
                    0
                  )
                ) AS balance_pence

              FROM fee_invoices i

              WHERE i.student_id = ?

              ORDER BY
                i.due_date DESC,
                i.created_at DESC
              `,
            )
            .bind(
              studentId,
            ),
        ),
      ]);

    const directDebit =
      await db
        .prepare(
          `
          SELECT
            d.*

          FROM direct_debit_mandates d

          INNER JOIN student_guardians sg
            ON sg.guardian_id = d.guardian_id

          WHERE sg.student_id = ?
            AND d.provider = 'gocardless'

          ORDER BY
            d.created_at DESC

          LIMIT 1
          `,
        )
        .bind(
          studentId,
        )
        .first<DbRow>();

    return json({
      ok: true,

      data: {
        student,
        guardians,
        enrolments,
        attendance,
        progress,
        agreements:
          user.role ===
            "parent" ||
          user.role ===
            "admin"
            ? agreements
            : [],
        invoices:
          user.role ===
            "parent" ||
          user.role ===
            "admin"
            ? invoices
            : [],
        directDebit:
          user.role ===
            "parent" ||
          user.role ===
            "admin"
            ? directDebit ?? null
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Student profile failed:",
      error,
    );

    return fail(error);
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const user = await actor(
      request,
      ["admin", "parent"],
    );

    const input = await body(request);
    const studentId = required(
      input.id,
      "Student ID",
    );
    const db = d1();

    if (user.role === "parent") {
      const access = await db
        .prepare(
          `SELECT s.id
           FROM students s
           INNER JOIN student_guardians sg
             ON sg.student_id = s.id
           INNER JOIN guardians g
             ON g.id = sg.guardian_id
           WHERE s.id = ?
             AND g.user_id = ?
           LIMIT 1`,
        )
        .bind(studentId, user.id)
        .first<{ id: string }>();

      if (!access) {
        throw new ApiError(
          403,
          "You cannot edit this student profile.",
        );
      }
    }

    const current = await db
      .prepare(
        `SELECT id, student_number
         FROM students
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(studentId)
      .first<{
        id: string;
        student_number: string;
      }>();

    if (!current) {
      return json(
        { ok: false, error: "Student was not found." },
        404,
      );
    }

    const firstName = required(
      input.firstName,
      "First name",
    );
    const lastName = required(
      input.lastName,
      "Last name",
    );
    const dateOfBirth = required(
      input.dateOfBirth,
      "Date of birth",
    );
    const genderInput = required(
      input.gender,
      "Gender",
    ).toLowerCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      throw new ApiError(
        400,
        "Date of birth must be a valid date.",
      );
    }

    if (!["male", "female"].includes(genderInput)) {
      throw new ApiError(
        400,
        "Gender must be Male or Female.",
      );
    }

    const studentNumber =
      user.role === "admin"
        ? required(input.studentNumber, "Student number")
        : current.student_number;

    if (user.role === "admin") {
      const duplicate = await db
        .prepare(
          `SELECT id
           FROM students
           WHERE lower(student_number) = lower(?)
             AND id <> ?
           LIMIT 1`,
        )
        .bind(studentNumber, studentId)
        .first<{ id: string }>();

      if (duplicate) {
        throw new ApiError(
          409,
          "Another student already uses this student number.",
        );
      }
    }

    const updated = await db
      .prepare(
        `UPDATE students
         SET
           student_number = ?,
           first_name = ?,
           last_name = ?,
           date_of_birth = ?,
           gender = ?,
           ethnic_group = ?,
           medical_notes = ?,
           allergy_notes = ?,
           additional_needs = ?,
           photo_consent = ?,
           emergency_consent = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
      )
      .bind(
        studentNumber,
        firstName,
        lastName,
        dateOfBirth,
        genderInput === "male" ? "Male" : "Female",
        optional(input.ethnicGroup),
        optional(input.medicalNotes),
        optional(input.allergyNotes),
        optional(input.additionalNeeds),
        boolean(input.photoConsent) ? 1 : 0,
        boolean(input.emergencyConsent) ? 1 : 0,
        studentId,
      )
      .first<DbRow>();

    await audit(
      user,
      "update-profile",
      "students",
      studentId,
      { editedByRole: user.role },
    );

    return json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    console.error(
      "Student profile update failed:",
      error,
    );

    return fail(error);
  }
}
