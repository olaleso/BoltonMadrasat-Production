import { d1 } from "@/db";
import {
  actor,
  fail,
  json,
  ApiError,
} from "@/lib/backend";

type SearchResult = {
  id: string;
  kind:
    | "student"
    | "guardian"
    | "staff"
    | "application";
  title: string;
  subtitle: string;
  meta?: string;
  section: string;
  studentId?: string;
};

async function all<T>(
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
      ["admin"],
    );

    const url =
      new URL(
        request.url,
      );

    const q =
      (
        url.searchParams
          .get("q") ??
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " ",
        );

    if (
      q.length < 2
    ) {
      return json({
        ok: true,
        data: [],
      });
    }

    if (
      q.length > 100
    ) {
      throw new ApiError(
        400,
        "Search is too long.",
      );
    }

    const like =
      `%${q}%`;

    const students =
      await all<{
        id: string;
        student_number: string;
        student_name: string;
        class_name: string | null;
        guardian_name: string | null;
      }>(
        `select
           s.id,
           s.student_number,
           trim(
             s.first_name ||
             ' ' ||
             s.last_name
           ) as student_name,

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
               e.enrolled_at
                 desc
             limit 1
           ) as class_name,

           (
             select g.full_name
             from student_guardians sg
             join guardians g
               on g.id =
                  sg.guardian_id
             where
               sg.student_id =
                 s.id
               and sg.is_primary =
                 1
             limit 1
           ) as guardian_name

         from students s

         where
           lower(
             trim(
               s.first_name ||
               ' ' ||
               s.last_name
             )
           )
             like lower(?)

           or lower(
             s.student_number
           )
             like lower(?)

         order by
           s.last_name,
           s.first_name

         limit 8`,
        like,
        like,
      );

    const guardians =
      await all<{
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        children: string | null;
      }>(
        `select
           g.id,
           g.full_name,
           g.email,
           g.phone,

           group_concat(
             distinct
             trim(
               s.first_name ||
               ' ' ||
               s.last_name
             )
           ) as children

         from guardians g

         left join student_guardians sg
           on sg.guardian_id =
              g.id

         left join students s
           on s.id =
              sg.student_id

         where
           lower(
             g.full_name
           )
             like lower(?)

           or lower(
             g.email
           )
             like lower(?)

           or lower(
             coalesce(
               g.phone,
               ''
             )
           )
             like lower(?)

         group by
           g.id

         order by
           g.full_name

         limit 8`,
        like,
        like,
        like,
      );

    const staff =
      await all<{
        id: string;
        display_name: string;
        email: string;
        roles: string | null;
      }>(
        `select
           u.id,
           u.display_name,
           u.email,

           group_concat(
             distinct ur.role
           ) as roles

         from users u

         join user_roles ur
           on ur.user_id =
              u.id

         where
           ur.role !=
             'parent'

           and (
             lower(
               u.display_name
             )
               like lower(?)

             or lower(
               u.email
             )
               like lower(?)
           )

         group by
           u.id

         order by
           u.display_name

         limit 8`,
        like,
        like,
      );

    const applications =
      await all<{
        id: string;
        student_id: string;
        student_number: string;
        student_name: string;
        status: string;
        guardian_name: string | null;
      }>(
        `select
           a.id,
           a.student_id,
           s.student_number,
           trim(
             s.first_name ||
             ' ' ||
             s.last_name
           ) as student_name,
           a.status,
           g.full_name as guardian_name

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

         where
           lower(
             a.id
           )
             like lower(?)

           or lower(
             s.student_number
           )
             like lower(?)

           or lower(
             trim(
               s.first_name ||
               ' ' ||
               s.last_name
             )
           )
             like lower(?)

         order by
           a.created_at
             desc

         limit 8`,
        like,
        like,
        like,
      );

    const data:
      SearchResult[] = [
        ...students.map(
          (row) => ({
            id:
              row.id,
            kind:
              "student" as const,
            title:
              row.student_name,
            subtitle:
              row.student_number,
            meta:
              [
                row.class_name,
                row.guardian_name
                  ? `Guardian: ${row.guardian_name}`
                  : "",
              ]
                .filter(Boolean)
                .join(" • "),
            section:
              "students",
            studentId:
              row.id,
          }),
        ),

        ...guardians.map(
          (row) => ({
            id:
              row.id,
            kind:
              "guardian" as const,
            title:
              row.full_name,
            subtitle:
              row.email,
            meta:
              [
                row.phone,
                row.children
                  ? `Children: ${row.children}`
                  : "",
              ]
                .filter(Boolean)
                .join(" • "),
            section:
              "guardians",
          }),
        ),

        ...staff.map(
          (row) => ({
            id:
              row.id,
            kind:
              "staff" as const,
            title:
              row.display_name,
            subtitle:
              row.email,
            meta:
              row.roles
                ? `Roles: ${row.roles}`
                : "",
            section:
              "staff",
          }),
        ),

        ...applications.map(
          (row) => ({
            id:
              row.id,
            kind:
              "application" as const,
            title:
              row.student_name,
            subtitle:
              `${row.student_number} • ${row.status.replaceAll("_", " ")}`,
            meta:
              row.guardian_name
                ? `Guardian: ${row.guardian_name}`
                : "",
            section:
              "applications",
            studentId:
              row.student_id,
          }),
        ),
      ];

    return json({
      ok: true,
      data:
        data.slice(
          0,
          24,
        ),
    });
  }
  catch (error) {
    return fail(error);
  }
}
