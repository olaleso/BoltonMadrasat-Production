import { d1 } from "@/db";
import { hash } from "bcryptjs";
import {
  actor,
  audit,
  boolean,
  body,
  fail,
  integer,
  json,
  optional,
  required,
  type Role,
  ApiError,
} from "@/lib/backend";
import { provisionParentAccess } from "@/lib/parent-access";

const resources = {
  students: {
    table: "students",
    readRoles: ["admin", "teacher", "safeguarding"],
    // Student creation must go through the complete manual-registration
    // workflow so guardian, class, parent access and fees cannot be omitted.
    createRoles: [],
  },

  guardians: {
    table: "guardians",
    readRoles: ["admin", "safeguarding"],
    createRoles: ["admin"],
  },

  applications: {
    table: "applications",
    readRoles: ["admin"],
    createRoles: [],
  },

  classes: {
    table: "classes",
    readRoles: ["admin", "teacher"],
    createRoles: ["admin"],
  },

  attendance: {
    table: "attendance",
    readRoles: ["admin", "teacher"],
    createRoles: ["admin", "teacher"],
  },

  progress: {
    table: "progress",
    readRoles: ["admin", "teacher", "parent"],
    createRoles: ["admin", "teacher"],
  },

  fees: {
    table: "fees",
    readRoles: ["admin", "finance", "parent"],
    createRoles: ["admin", "finance"],
  },

  payments: {
    table: "payments",
    readRoles: ["admin", "finance"],
    createRoles: ["admin", "finance"],
  },

  enrolments: {
    table: "enrolments",
    readRoles: ["admin", "teacher"],
    createRoles: ["admin"],
  },

  compliance: {
    table: "compliance",
    readRoles: ["admin", "safeguarding"],
    createRoles: ["admin", "safeguarding"],
  },

  announcements: {
    table: "announcements",
    readRoles: ["admin", "teacher", "parent"],
    createRoles: ["admin", "teacher"],
  },

  staff: {
    table: "users",
    readRoles: ["admin", "safeguarding"],
    createRoles: ["admin"],
  },

  activity_log: {
    table: "audit_log",
    readRoles: ["admin"],
    createRoles: [],
  },
} as const;

type Resource = keyof typeof resources;

type ApplicationStatus =
  | "payment_pending"
  | "submitted"
  | "under_review"
  | "waitlisted"
  | "accepted"
  | "rejected";

const applicationTransitions: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  payment_pending: ["submitted"],
  submitted: [
    "under_review",
    "accepted",
    "waitlisted",
    "rejected",
  ],
  under_review: ["accepted", "waitlisted", "rejected"],
  waitlisted: ["under_review", "accepted", "rejected"],
  accepted: ["under_review"],
  rejected: ["under_review"],
};

const getResource = (value: string) => {
  if (!(value in resources)) {
    throw new ApiError(404, "Unknown resource");
  }

  return value as Resource;
};

async function all<T = Record<string, unknown>>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = d1().prepare(query);

  const result = bindings.length
    ? await statement.bind(...bindings).all<T>()
    : await statement.all<T>();

  return result.results;
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

async function execute(
  query: string,
  ...bindings: unknown[]
) {
  const statement = d1().prepare(query);

  return bindings.length
    ? statement.bind(...bindings).run()
    : statement.run();
}

const now = () => new Date().toISOString();

function applicationStatus(
  value: unknown,
): ApplicationStatus {
  const raw = required(value, "Status")
    .toLowerCase()
    .replaceAll("-", "_")
    .replace(/\s+/g, "_");

  const allowed: ApplicationStatus[] = [
    "payment_pending",
    "submitted",
    "under_review",
    "waitlisted",
    "accepted",
    "rejected",
  ];

  if (
    !allowed.includes(
      raw as ApplicationStatus,
    )
  ) {
    throw new ApiError(
      400,
      `Unknown application status: ${raw}`,
    );
  }

  return raw as ApplicationStatus;
}

function applicationStudentStatus(
  status: ApplicationStatus,
) {
  switch (status) {
    case "accepted":
      return "active";

    case "rejected":
      return "rejected";

    default:
      return "applicant";
  }
}

function assertApplicationTransition(
  current: ApplicationStatus,
  next: ApplicationStatus,
) {
  if (current === next) {
    throw new ApiError(
      409,
      `Application is already ${next}`,
    );
  }

  const allowed =
    applicationTransitions[current] ?? [];

  if (!allowed.includes(next)) {
    throw new ApiError(
      409,
      `Application cannot move from ${current} to ${next}. Allowed next status: ${
        allowed.length
          ? allowed.join(", ")
          : "none"
      }`,
    );
  }
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      resource: string;
    }>;
  },
) {
  try {
    const resource = getResource(
      (await params).resource,
    );

    const who = await actor(
      request,
      [
        ...resources[resource]
          .readRoles,
      ] as Role[],
    );

    let data:
      readonly unknown[] = [];

    switch (resource) {
      case "students":
        data =
          who.role === "teacher"
            ? await all(
                `select
                   s.*,
                   s.first_name || ' ' || s.last_name as name,
                   g.full_name as guardian,
                   g.phone,
                   case when g.id is null then 1 else 0 end as guardian_missing,
                   case when g.id is null then 'Required' else 'Complete' end as guardian_status,
                   (select c2.name
                      from enrolments e2
                      join classes c2 on c2.id = e2.class_id
                     where e2.student_id = s.id
                       and e2.status = 'active'
                     order by e2.enrolled_at desc
                     limit 1) as class_name,
                   group_concat(distinct c.name) as assigned_classes
                 from students s
                 join enrolments e
                   on e.student_id = s.id
                  and e.status = 'active'
                 join classes c
                   on c.id = e.class_id
                  and c.status = 'active'
                  and c.teacher_id = ?
                 left join student_guardians sg
                   on sg.student_id = s.id
                  and sg.is_primary = 1
                 left join guardians g
                   on g.id = sg.guardian_id
                 where s.status = 'active'
                 group by
                   s.id,
                   g.id,
                   g.full_name,
                   g.phone
                 order by
                   s.last_name,
                   s.first_name`,
                who.id,
              )
            : await all(
                `select
                   s.*,
                   s.first_name || ' ' || s.last_name as name,
                   g.full_name as guardian,
                   g.phone,
                   case when g.id is null then 1 else 0 end as guardian_missing,
                   case when g.id is null then 'Required' else 'Complete' end as guardian_status,
                   (select e2.class_id
                      from enrolments e2
                     where e2.student_id = s.id
                     order by
                       case when e2.status = 'active' then 0 else 1 end,
                       e2.enrolled_at desc
                     limit 1) as class_id,
                   (select c2.name
                      from enrolments e2
                      join classes c2 on c2.id = e2.class_id
                     where e2.student_id = s.id
                     order by
                       case when e2.status = 'active' then 0 else 1 end,
                       e2.enrolled_at desc
                     limit 1) as class_name,
                   (select e2.status
                      from enrolments e2
                     where e2.student_id = s.id
                     order by
                       case when e2.status = 'active' then 0 else 1 end,
                       e2.enrolled_at desc
                     limit 1) as enrolment_status
                 from students s
                 left join student_guardians sg
                   on sg.student_id = s.id
                  and sg.is_primary = 1
                 left join guardians g
                   on g.id = sg.guardian_id
                 order by
                   s.last_name,
                   s.first_name`,
              );

        break;

      case "guardians":
        data = await all(
          `select
             g.*,
             count(sg.student_id) as children
           from guardians g
           left join student_guardians sg
             on sg.guardian_id = g.id
           group by g.id
           order by g.full_name`,
        );

        break;

      case "applications":
        data = await all(
          `select
             a.*,
             s.student_number,
             s.first_name || ' ' || s.last_name as student_name,
             s.gender,
             s.status as student_status,
             g.full_name as guardian_name,
             g.email as guardian_email,
             g.phone as guardian_phone,
             reviewer.display_name as reviewer_name
           from applications a
           join students s
             on s.id = a.student_id
           left join student_guardians sg
             on sg.student_id = s.id
            and sg.is_primary = 1
           left join guardians g
             on g.id = sg.guardian_id
           left join users reviewer
             on reviewer.id = a.reviewed_by
           order by
             case
               when a.submitted_at is null
               then 1
               else 0
             end,
             a.submitted_at desc,
             a.created_at desc`,
        );

        break;

      case "classes":
        data = await all(
          `select
             c.*,
             cc.name as category_name,
             u.display_name as teacher,
             count(e.id) as enrolled
           from classes c
           left join class_categories cc
             on cc.id = c.category_id
           left join users u
             on u.id = c.teacher_id
           left join enrolments e
             on e.class_id = c.id
            and e.status = 'active'
           group by
             c.id,
             cc.name,
             u.display_name
           order by
             coalesce(cc.sort_order, 9999),
             c.name`,
        );

        break;

      case "attendance":
        data =
          who.role === "teacher"
            ? await all(
                `select
                   a.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   c.name as class_name,
                   g.full_name as collected_by
                 from attendance a
                 join students s
                   on s.id = a.student_id
                 join classes c
                   on c.id = a.class_id
                 left join guardians g
                   on g.id = a.collected_by_guardian_id
                 where c.teacher_id = ?
                 order by
                   a.session_date desc,
                   s.last_name,
                   s.first_name`,
                who.id,
              )
            : await all(
                `select
                   a.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   c.name as class_name,
                   g.full_name as collected_by
                 from attendance a
                 join students s
                   on s.id = a.student_id
                 join classes c
                   on c.id = a.class_id
                 left join guardians g
                   on g.id = a.collected_by_guardian_id
                 order by
                   a.session_date desc,
                   s.last_name,
                   s.first_name`,
              );

        break;

      case "progress":
        data =
          who.role === "parent"
            ? await all(
                `select
                   p.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   c.name as class_name,
                   u.display_name as recorded_by_name
                 from progress p
                 join students s
                   on s.id = p.student_id
                 join classes c
                   on c.id = p.class_id
                 join student_guardians sg
                   on sg.student_id = s.id
                 join guardians g
                   on g.id = sg.guardian_id
                 left join users u
                   on u.id = p.recorded_by
                 where g.user_id = ?
                 order by
                   p.assessed_at desc`,
                who.id,
              )
            : who.role === "teacher"
              ? await all(
                  `select
                     p.*,
                     s.first_name || ' ' || s.last_name as student_name,
                     c.name as class_name,
                     u.display_name as recorded_by_name
                   from progress p
                   join students s
                     on s.id = p.student_id
                   join classes c
                     on c.id = p.class_id
                   left join users u
                     on u.id = p.recorded_by
                   where c.teacher_id = ?
                   order by
                     p.assessed_at desc`,
                  who.id,
                )
              : await all(
                  `select
                     p.*,
                     s.first_name || ' ' || s.last_name as student_name,
                     c.name as class_name,
                     u.display_name as recorded_by_name
                   from progress p
                   join students s
                     on s.id = p.student_id
                   join classes c
                     on c.id = p.class_id
                   left join users u
                     on u.id = p.recorded_by
                   order by
                     p.assessed_at desc`,
                );

        break;

      case "fees":
        data =
          who.role === "parent"
            ? await all(
                `select
                   f.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   coalesce(sum(p.amount_pence), 0) as paid_pence
                 from fees f
                 join students s
                   on s.id = f.student_id
                 join student_guardians sg
                   on sg.student_id = s.id
                 join guardians g
                   on g.id = sg.guardian_id
                 left join payments p
                   on p.fee_id = f.id
                 where g.user_id = ?
                 group by
                   f.id,
                   s.first_name,
                   s.last_name
                 order by
                   f.due_date desc`,
                who.id,
              )
            : await all(
                `select
                   f.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   coalesce(sum(p.amount_pence), 0) as paid_pence
                 from fees f
                 join students s
                   on s.id = f.student_id
                 left join payments p
                   on p.fee_id = f.id
                 group by
                   f.id,
                   s.first_name,
                   s.last_name
                 order by
                   f.due_date desc`,
              );

        break;

      case "announcements":
        data =
          who.role === "parent"
            ? await all(
                `select
                   a.*,
                   u.display_name as author
                 from announcements a
                 left join users u
                   on u.id = a.author_id
                 where
                   a.status = 'published'
                   and a.audience in ('all', 'parents')
                 order by
                   a.created_at desc`,
              )
            : await all(
                `select
                   a.*,
                   u.display_name as author
                 from announcements a
                 left join users u
                   on u.id = a.author_id
                 order by
                   a.created_at desc`,
              );

        break;

      case "payments":
        data = await all(
          `select
             p.*,
             f.description,
             s.first_name || ' ' || s.last_name as student_name
           from payments p
           left join fees f
             on f.id = p.fee_id
           left join students s
             on s.id = f.student_id
           order by
             p.received_at desc`,
        );

        break;

      case "enrolments":
        data =
          who.role === "teacher"
            ? await all(
                `select
                   e.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   s.student_number,
                   s.gender,
                   c.name as class_name,
                   c.capacity,
                   c.status as class_status,
                   u.display_name as teacher
                 from enrolments e
                 join students s
                   on s.id = e.student_id
                 join classes c
                   on c.id = e.class_id
                 left join users u
                   on u.id = c.teacher_id
                 where
                   c.teacher_id = ?
                   and e.status = 'active'
                 order by
                   c.name,
                   s.last_name,
                   s.first_name`,
                who.id,
              )
            : await all(
                `select
                   e.*,
                   s.first_name || ' ' || s.last_name as student_name,
                   s.student_number,
                   s.gender,
                   c.name as class_name,
                   c.capacity,
                   c.status as class_status,
                   u.display_name as teacher
                 from enrolments e
                 join students s
                   on s.id = e.student_id
                 join classes c
                   on c.id = e.class_id
                 left join users u
                   on u.id = c.teacher_id
                 order by
                   case when e.status = 'active' then 0 else 1 end,
                   c.name,
                   s.last_name,
                   s.first_name`,
              );

        break;

      case "compliance":
        data = await all(
          `select
             sc.*,
             u.display_name as staff_name,
             u.email
           from compliance sc
           join users u
             on u.id = sc.user_id
           order by
             case
               when sc.expires_at is null
               then 1
               else 0
             end,
             sc.expires_at`,
        );

        break;

      case "activity_log":
        data = await all(
          `select
             a.id,
             a.created_at,
             coalesce(
               u.display_name,
               'Former user / system'
             ) as actor,
             u.email as actor_email,
             a.action,
             a.entity_type,
             a.entity_id,
             a.details
           from audit_log a
           left join users u
             on u.id = a.user_id
           order by
             a.created_at desc
           limit 500`,
        );

        break;

      case "staff":
        data = await all(
          `select
             u.id,
             u.email,
             u.display_name,
             u.role,
             u.status,
             u.created_at,

             (
               select group_concat(ur2.role, ', ')
               from user_roles ur2
               where ur2.user_id = u.id
                 and ur2.role <> 'parent'
               order by
                 case ur2.role
                   when 'admin' then 1
                   when 'teacher' then 2
                   when 'finance' then 3
                   when 'safeguarding' then 4
                   else 99
                 end
             ) as roles,

             (
               select ur3.role
               from user_roles ur3
               where ur3.user_id = u.id
                 and ur3.role <> 'parent'
               order by
                 case ur3.role
                   when 'admin' then 1
                   when 'teacher' then 2
                   when 'finance' then 3
                   when 'safeguarding' then 4
                   else 99
                 end
               limit 1
             ) as staff_role,

             (
               select c.check_type
               from compliance c
               where c.user_id = u.id
               order by
                 case
                   when c.expires_at is null
                   then 1
                   else 0
                 end,
                 c.expires_at desc,
                 c.created_at desc
               limit 1
             ) as check_type,

             (
               select c.expires_at
               from compliance c
               where c.user_id = u.id
               order by
                 case
                   when c.expires_at is null
                   then 1
                   else 0
                 end,
                 c.expires_at desc,
                 c.created_at desc
               limit 1
             ) as expires_at,

             (
               select c.status
               from compliance c
               where c.user_id = u.id
               order by
                 case
                   when c.expires_at is null
                   then 1
                   else 0
                 end,
                 c.expires_at desc,
                 c.created_at desc
               limit 1
             ) as compliance_status

           from users u

           where exists (
             select 1
             from user_roles ur
             where ur.user_id = u.id
               and ur.role in (
                 'admin',
                 'teacher',
                 'finance',
                 'safeguarding'
               )
           )

           order by
             u.display_name`,
        );

        break;
    }

    return json({
      ok: true,
      data,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      resource: string;
    }>;
  },
) {
  try {
    const resource = getResource(
      (await params).resource,
    );

    const createRoles = [
      ...resources[resource]
        .createRoles,
    ] as Role[];

    if (!createRoles.length) {
      throw new ApiError(
        405,
        `Creation is not available through the ${resource} resource endpoint`,
      );
    }

    const who = await actor(
      request,
      createRoles,
    );

    const x =
      await body(request);

    let row:
      Record<string, unknown> | null =
      null;

    const id =
      crypto.randomUUID();

    switch (resource) {
      case "students":
        row = await first(
          `insert into students
             (
               id,
               student_number,
               first_name,
               last_name,
               date_of_birth,
               gender,
               medical_notes,
               allergy_notes,
               additional_needs,
               photo_consent,
               emergency_consent,
               status
             )
           values (
             ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?
           )
           returning *`,
          id,
          required(
            x.studentNumber,
            "Student number",
          ),
          required(
            x.firstName,
            "First name",
          ),
          required(
            x.lastName,
            "Last name",
          ),
          required(
            x.dateOfBirth,
            "Date of birth",
          ),
          required(
            x.gender,
            "Gender",
          ),
          optional(
            x.medicalNotes,
          ),
          optional(
            x.allergyNotes,
          ),
          optional(
            x.additionalNeeds,
          ),
          boolean(
            x.photoConsent,
          )
            ? 1
            : 0,
          boolean(
            x.emergencyConsent,
          )
            ? 1
            : 0,
          optional(
            x.status,
          ) ?? "active",
        );

        break;

      case "guardians":
        {
          const studentId =
            required(
              x.studentId,
              "Student",
            );

          const student =
            await first<{
              id: string;
              first_name: string;
              last_name: string;
            }>(
              `select
                 id,
                 first_name,
                 last_name
               from students
               where id = ?
               limit 1`,
              studentId,
            );

          if (!student) {
            throw new ApiError(
              404,
              "Student not found.",
            );
          }

          const selectedGuardianId =
            optional(
              x.guardianId,
            );

          if (selectedGuardianId) {
            const selectedGuardian =
              await first<{
                id: string;
                full_name: string;
                email: string | null;
                phone: string | null;
                relationship: string | null;
              }>(
                `select
                   id,
                   full_name,
                   email,
                   phone,
                   relationship
                 from guardians
                 where id = ?
                 limit 1`,
                selectedGuardianId,
              );

            if (!selectedGuardian) {
              throw new ApiError(
                404,
                "Guardian not found.",
              );
            }

            const existingLink =
              await first<{
                id: string;
              }>(
                `select id
                 from student_guardians
                 where
                   student_id = ?
                   and guardian_id = ?
                 limit 1`,
                studentId,
                selectedGuardianId,
              );

            if (existingLink) {
              throw new ApiError(
                409,
                "This guardian is already linked to the selected student.",
              );
            }

            const isPrimary =
              boolean(
                x.isPrimary,
              );

            const db =
              d1();

            const statements = [];

            if (isPrimary) {
              statements.push(
                db
                  .prepare(
                    `update student_guardians
                     set
                       is_primary = 0,
                       updated_at = CURRENT_TIMESTAMP
                     where student_id = ?
                       and is_primary = 1`,
                  )
                  .bind(
                    studentId,
                  ),
              );
            }

            statements.push(
              db
                .prepare(
                  `insert into student_guardians
                     (
                       id,
                       student_id,
                       guardian_id,
                       is_primary,
                       authorised_collection
                     )
                   values (?, ?, ?, ?, 1)`,
                )
                .bind(
                  crypto.randomUUID(),
                  studentId,
                  selectedGuardianId,
                  isPrimary
                    ? 1
                    : 0,
                ),
            );

            await db.batch(
              statements,
            );

            await audit(
              who,
              "link-existing-guardian",
              "guardians",
              selectedGuardianId,
              {
                studentId,
                studentName:
                  `${student.first_name} ${student.last_name}`,
                guardianName:
                  selectedGuardian.full_name,
                guardianEmail:
                  selectedGuardian.email,
                isPrimary,
              },
            );

            row =
              await first(
                `select
                   g.*,
                   count(sg.student_id) as children
                 from guardians g
                 left join student_guardians sg
                   on sg.guardian_id = g.id
                 where g.id = ?
                 group by g.id
                 limit 1`,
                selectedGuardianId,
              );

            return json(
              {
                ok: true,
                data: row,
                linkedExisting: true,
              },
              201,
            );
          }

          const email =
            required(
              x.email,
              "Email",
            ).toLowerCase();

          const fullName =
            required(
              x.fullName,
              "Full name",
            );

          const phone =
            required(
              x.phone,
              "Phone",
            );

          const relationship =
            required(
              x.relationship,
              "Relationship",
            );

          const isPrimary =
            boolean(
              x.isPrimary,
            );

          const existingGuardian =
            await first<{
              id: string;
            }>(
              `select id
               from guardians
               where lower(email) = lower(?)
               limit 1`,
              email,
            );

          const guardianId =
            existingGuardian?.id ??
            id;

          const existingLink =
            await first<{
              id: string;
            }>(
              `select id
               from student_guardians
               where
                 student_id = ?
                 and guardian_id = ?
               limit 1`,
              studentId,
              guardianId,
            );

          if (existingLink) {
            throw new ApiError(
              409,
              "This guardian is already linked to the selected student.",
            );
          }

          const db =
            d1();

          const statements = [];

          if (existingGuardian) {
            statements.push(
              db
                .prepare(
                  `update guardians
                   set
                     full_name = ?,
                     phone = ?,
                     address = ?,
                     postcode = ?,
                     emergency_contact_number = ?,
                     relationship = ?,
                     updated_at = CURRENT_TIMESTAMP
                   where id = ?`,
                )
                .bind(
                  fullName,
                  phone,
                  optional(
                    x.address,
                  ),
                  optional(
                    x.postcode,
                  ),
                  optional(
                    x.emergencyContactNumber,
                  ),
                  relationship,
                  guardianId,
                ),
            );
          } else {
            statements.push(
              db
                .prepare(
                  `insert into guardians
                     (
                       id,
                       full_name,
                       email,
                       phone,
                       address,
                       postcode,
                       emergency_contact_number,
                       relationship
                     )
                   values (
                     ?, ?, ?, ?, ?, ?, ?, ?
                   )`,
                )
                .bind(
                  guardianId,
                  fullName,
                  email,
                  phone,
                  optional(
                    x.address,
                  ),
                  optional(
                    x.postcode,
                  ),
                  optional(
                    x.emergencyContactNumber,
                  ),
                  relationship,
                ),
            );
          }

          if (isPrimary) {
            statements.push(
              db
                .prepare(
                  `update student_guardians
                   set
                     is_primary = 0,
                     updated_at = CURRENT_TIMESTAMP
                   where student_id = ?
                     and is_primary = 1`,
                )
                .bind(
                  studentId,
                ),
            );
          }

          statements.push(
            db
              .prepare(
                `insert into student_guardians
                   (
                     id,
                     student_id,
                     guardian_id,
                     is_primary,
                     authorised_collection
                   )
                 values (?, ?, ?, ?, 1)`,
              )
              .bind(
                crypto.randomUUID(),
                studentId,
                guardianId,
                isPrimary
                  ? 1
                  : 0,
              ),
          );

          statements.push(
            db
              .prepare(
                `insert into audit_log
                   (
                     id,
                     user_id,
                     action,
                     entity_type,
                     entity_id,
                     details
                   )
                 values (?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                who.id,
                existingGuardian
                  ? "link-existing-guardian"
                  : "create-and-link-guardian",
                "guardians",
                guardianId,
                JSON.stringify({
                  studentId,
                  studentName:
                    `${student.first_name} ${student.last_name}`,
                  email,
                  relationship,
                  isPrimary,
                }),
              ),
          );

          await db.batch(
            statements,
          );

          row =
            await first(
              `select
                 g.*,
                 count(sg.student_id) as children
               from guardians g
               left join student_guardians sg
                 on sg.guardian_id = g.id
               where g.id = ?
               group by g.id
               limit 1`,
              guardianId,
            );

          break;
        }

      case "classes": {
        const className =
          required(
            x.name,
            "Class name",
          )
            .replace(/\s+/g, " ")
            .trim();

        if (className.length > 100) {
          throw new ApiError(
            400,
            "Class name must be 100 characters or fewer.",
          );
        }

        const categoryId =
          required(
            x.categoryId,
            "Category",
          );

        const category =
          await first<{
            id: string;
            name: string;
          }>(
            `select id, name
             from class_categories
             where id = ?
               and status = 'active'
             limit 1`,
            categoryId,
          );

        if (!category) {
          throw new ApiError(
            400,
            "Please select an active category.",
          );
        }

        const teacherId = optional(
          x.teacherId,
        );

        if (teacherId) {
          const teacher = await first<{ id: string }>(
            `select u.id
             from users u
             where u.id = ?
               and u.status = 'active'
               and exists (
                 select 1
                 from user_roles ur
                 where ur.user_id = u.id
                   and ur.role = 'teacher'
               )
             limit 1`,
            teacherId,
          );

          if (!teacher) {
            throw new ApiError(
              400,
              "Please select an active teacher account.",
            );
          }
        }

        const existingClass =
          await first<{
            id: string;
          }>(
            `select id
             from classes
             where lower(name) = lower(?)
               and status = 'active'
             limit 1`,
            className,
          );

        if (existingClass) {
          throw new ApiError(
            409,
            `${className} already exists.`,
          );
        }

        row =
          await first(
            `insert into classes
               (
                 id,
                 name,
                 subject,
                 level,
                 category_id,
                 teacher_id,
                 room,
                 day_of_week,
                 start_time,
                 end_time,
                 capacity,
                 status
               )
             values (
               ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?,
               'active'
             )
             returning *`,
            id,
            className,
            required(
              x.subject,
              "Subject",
            ),
            category.name,
            category.id,
            teacherId,
            required(
              x.room,
              "Room",
            ),
            integer(
              x.dayOfWeek,
              "Day",
              0,
            ),
            required(
              x.startTime,
              "Start time",
            ),
            required(
              x.endTime,
              "End time",
            ),
            integer(
              x.capacity,
              "Capacity",
              1,
            ),
          );

        break;
      }

      case "attendance": {
        const studentId =
          required(
            x.studentId,
            "Student",
          );

        const classId =
          required(
            x.classId,
            "Class",
          );

        const sessionDate =
          required(
            x.sessionDate,
            "Date",
          );

        const attendanceStatus =
          required(
            x.status,
            "Status",
          )
            .toLowerCase()
            .trim();

        const allowedAttendanceStatuses = [
          "present",
          "absent",
          "late",
          "excused",
        ];

        if (
          !allowedAttendanceStatuses.includes(
            attendanceStatus,
          )
        ) {
          throw new ApiError(
            400,
            `Invalid attendance status. Allowed values: ${allowedAttendanceStatuses.join(", ")}`,
          );
        }

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            sessionDate,
          )
        ) {
          throw new ApiError(
            400,
            "Session date must be in YYYY-MM-DD format",
          );
        }

        const student =
          await first<{
            id: string;
            first_name: string;
            last_name: string;
            status: string;
          }>(
            `select
               id,
               first_name,
               last_name,
               status
             from students
             where id = ?
             limit 1`,
            studentId,
          );

        if (!student) {
          throw new ApiError(
            404,
            "Student not found",
          );
        }

        if (
          student.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Attendance cannot be recorded because the student status is ${student.status}.`,
          );
        }

        const classRow =
          await first<{
            id: string;
            name: string;
            teacher_id: string | null;
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

        if (!classRow) {
          throw new ApiError(
            404,
            "Class not found",
          );
        }

        if (
          classRow.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Attendance cannot be recorded because ${classRow.name} is not active.`,
          );
        }

        if (
          who.role === "teacher" &&
          classRow.teacher_id !==
            who.id
        ) {
          throw new ApiError(
            403,
            "You can only record attendance for classes assigned to you.",
          );
        }

        const enrolment =
          await first<{
            id: string;
          }>(
            `select
               id
             from enrolments
             where
               student_id = ?
               and class_id = ?
               and status = 'active'
             limit 1`,
            studentId,
            classId,
          );

        if (!enrolment) {
          throw new ApiError(
            409,
            `${student.first_name} ${student.last_name} is not actively enrolled in ${classRow.name}.`,
          );
        }

        const collectedByGuardianId =
          optional(
            x.collectedByGuardianId,
          );

        if (
          collectedByGuardianId
        ) {
          const collector =
            await first<{
              guardian_id: string;
              full_name: string;
              authorised_collection:
                number;
            }>(
              `select
                 sg.guardian_id,
                 g.full_name,
                 sg.authorised_collection
               from student_guardians sg
               join guardians g
                 on g.id =
                    sg.guardian_id
               where
                 sg.student_id = ?
                 and sg.guardian_id = ?
               limit 1`,
              studentId,
              collectedByGuardianId,
            );

          if (!collector) {
            throw new ApiError(
              409,
              "The selected collector is not linked to this student.",
            );
          }

          if (
            Number(
              collector.authorised_collection,
            ) !== 1
          ) {
            throw new ApiError(
              409,
              `${collector.full_name} is not authorised to collect this student.`,
            );
          }
        }

        const existing =
          await first<{
            id: string;
          }>(
            `select
               id
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

        row = await first(
          `insert into attendance
             (
               id,
               student_id,
               class_id,
               session_date,
               status,
               arrival_time,
               collection_time,
               collected_by_guardian_id,
               notes
             )
           values (
             ?, ?, ?, ?, ?, ?, ?, ?, ?
           )
           on conflict (
             student_id,
             class_id,
             session_date
           )
           do update set
             status =
               excluded.status,
             arrival_time =
               excluded.arrival_time,
             collection_time =
               excluded.collection_time,
             collected_by_guardian_id =
               excluded.collected_by_guardian_id,
             notes =
               excluded.notes,
             updated_at =
               CURRENT_TIMESTAMP
           returning *`,
          existing?.id ??
            id,
          studentId,
          classId,
          sessionDate,
          attendanceStatus,
          optional(
            x.arrivalTime,
          ),
          optional(
            x.collectionTime,
          ),
          collectedByGuardianId,
          optional(
            x.notes,
          ),
        );

        if (!row) {
          throw new ApiError(
            500,
            "Attendance record could not be saved",
          );
        }

        await audit(
          who,
          existing
            ? "update-attendance"
            : "create-attendance",
          "attendance",
          String(
            row.id ??
              existing?.id ??
              id,
          ),
          {
            studentId,
            studentName:
              `${student.first_name} ${student.last_name}`,
            classId,
            className:
              classRow.name,
            sessionDate,
            status:
              attendanceStatus,
            collectedByGuardianId,
          },
        );

        return json(
          {
            ok: true,
            data: row,
          },
          existing
            ? 200
            : 201,
        );
      }

      case "progress": {
        const studentId =
          required(
            x.studentId,
            "Student",
          );

        const classId =
          required(
            x.classId,
            "Class",
          );

        const strand =
          required(
            x.strand,
            "Strand",
          );

        const currentUnit =
          required(
            x.currentUnit,
            "Current unit",
          );

        const achievement =
          required(
            x.achievement,
            "Achievement",
          )
            .toLowerCase()
            .trim();

        const allowedAchievements = [
          "emerging",
          "developing",
          "secure",
          "mastered",
        ];

        if (
          !allowedAchievements.includes(
            achievement,
          )
        ) {
          throw new ApiError(
            400,
            `Invalid achievement. Allowed values: ${allowedAchievements.join(", ")}`,
          );
        }

        const assessedAt =
          required(
            x.assessedAt,
            "Assessment date",
          );

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            assessedAt,
          )
        ) {
          throw new ApiError(
            400,
            "Assessment date must be in YYYY-MM-DD format",
          );
        }

        let score:
          number | null =
          null;

        if (
          x.score !== null &&
          x.score !== undefined &&
          String(
            x.score,
          ).trim() !== ""
        ) {
          score = integer(
            x.score,
            "Score",
            0,
          );

          if (
            score > 100
          ) {
            throw new ApiError(
              400,
              "Score cannot be greater than 100",
            );
          }
        }

        const student =
          await first<{
            id: string;
            first_name: string;
            last_name: string;
            status: string;
          }>(
            `select
               id,
               first_name,
               last_name,
               status
             from students
             where id = ?
             limit 1`,
            studentId,
          );

        if (!student) {
          throw new ApiError(
            404,
            "Student not found",
          );
        }

        if (
          student.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Progress cannot be recorded because the student status is ${student.status}.`,
          );
        }

        const classRow =
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

        if (!classRow) {
          throw new ApiError(
            404,
            "Class not found",
          );
        }

        if (
          classRow.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Progress cannot be recorded because ${classRow.name} is not active.`,
          );
        }

        if (
          who.role ===
            "teacher" &&
          classRow.teacher_id !==
            who.id
        ) {
          throw new ApiError(
            403,
            "You can only record progress for classes assigned to you.",
          );
        }

        const enrolment =
          await first<{
            id: string;
          }>(
            `select
               id
             from enrolments
             where
               student_id = ?
               and class_id = ?
               and status = 'active'
             limit 1`,
            studentId,
            classId,
          );

        if (!enrolment) {
          throw new ApiError(
            409,
            `${student.first_name} ${student.last_name} is not actively enrolled in ${classRow.name}.`,
          );
        }

        row = await first(
          `insert into progress
             (
               id,
               student_id,
               class_id,
               strand,
               current_unit,
               achievement,
               score,
               teacher_comment,
               next_step,
               assessed_at,
               recorded_by
             )
           values (
             ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?
           )
           returning *`,
          id,
          studentId,
          classId,
          strand,
          currentUnit,
          achievement,
          score,
          optional(
            x.teacherComment,
          ),
          optional(
            x.nextStep,
          ),
          assessedAt,
          who.id,
        );

        if (!row) {
          throw new ApiError(
            500,
            "Progress record could not be saved",
          );
        }

        await audit(
          who,
          "create-progress",
          "progress",
          String(
            row.id ?? id,
          ),
          {
            studentId,
            studentName:
              `${student.first_name} ${student.last_name}`,
            classId,
            className:
              classRow.name,
            strand,
            currentUnit,
            achievement,
            score,
            assessedAt,
          },
        );

        return json(
          {
            ok: true,
            data: row,
          },
          201,
        );
      }

      case "fees":
        row = await first(
          `insert into fees
             (
               id,
               student_id,
               description,
               amount_pence,
               discount_pence,
               due_date,
               status
             )
           values (
             ?, ?, ?, ?, ?, ?,
             'due'
           )
           returning *`,
          id,
          required(
            x.studentId,
            "Student",
          ),
          required(
            x.description,
            "Description",
          ),
          integer(
            x.amountPence,
            "Amount",
            1,
          ),
          integer(
            x.discountPence ?? 0,
            "Discount",
          ),
          required(
            x.dueDate,
            "Due date",
          ),
        );

        break;

      case "announcements":
        row = await first(
          `insert into announcements
             (
               id,
               title,
               body,
               audience,
               status,
               author_id
             )
           values (
             ?, ?, ?, ?, ?, ?
           )
           returning *`,
          id,
          required(
            x.title,
            "Title",
          ),
          required(
            x.body,
            "Message",
          ),
          required(
            x.audience,
            "Audience",
          ),
          optional(
            x.status,
          ) ?? "published",
          who.id,
        );

        break;

      case "payments": {
        const feeId =
          required(
            x.feeId,
            "Fee",
          );

        row = await first(
          `insert into payments
             (
               id,
               fee_id,
               amount_pence,
               method,
               reference,
               received_at,
               recorded_by
             )
           values (
             ?, ?, ?, ?, ?, ?, ?
           )
           returning *`,
          id,
          feeId,
          integer(
            x.amountPence,
            "Amount",
            1,
          ),
          required(
            x.method,
            "Method",
          ),
          optional(
            x.reference,
          ),
          now(),
          who.id,
        );

        await execute(
          `update fees
           set
             status =
               case
                 when
                   coalesce(
                     (
                       select
                         sum(amount_pence)
                       from payments
                       where fee_id = fees.id
                     ),
                     0
                   )
                   >=
                   amount_pence
                   -
                   discount_pence
                 then 'paid'
                 else 'part-paid'
               end,
             updated_at =
               CURRENT_TIMESTAMP
           where id = ?`,
          feeId,
        );

        break;
      }

      case "enrolments": {
        const studentId =
          required(
            x.studentId,
            "Student",
          );

        const classId =
          required(
            x.classId,
            "Class",
          );

        const requestedStatus =
          String(
            x.status ??
              "active",
          )
            .trim()
            .toLowerCase();

        const allowedStatuses = [
          "active",
          "pending",
        ];

        if (
          !allowedStatuses.includes(
            requestedStatus,
          )
        ) {
          throw new ApiError(
            400,
            `New enrolments can only be active or pending.`,
          );
        }

        const enrolledAtRaw =
          String(
            x.enrolledAt ??
              "",
          ).trim();

        const enrolledAt =
          enrolledAtRaw
            ? enrolledAtRaw
            : new Date()
                .toISOString()
                .slice(0, 10);

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            enrolledAt,
          )
        ) {
          throw new ApiError(
            400,
            "Enrolment date must be in YYYY-MM-DD format.",
          );
        }

        const transferFromId =
          optional(
            x.transferFromId,
          );

        const student =
          await first<{
            id: string;
            first_name: string;
            last_name: string;
            gender: string | null;
            status: string;
          }>(
            `select
               id,
               first_name,
               last_name,
               gender,
               status
             from students
             where id = ?
             limit 1`,
            studentId,
          );

        if (!student) {
          throw new ApiError(
            404,
            "Student not found",
          );
        }

        if (
          student.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Student cannot be enrolled because their status is ${student.status}. Only active students can be enrolled.`,
          );
        }

        const classRow =
          await first<{
            id: string;
            name: string;
            capacity: number;
            status: string;
          }>(
            `select
               id,
               name,
               capacity,
               status
             from classes
             where id = ?
             limit 1`,
            classId,
          );

        if (!classRow) {
          throw new ApiError(
            404,
            "Class not found",
          );
        }

        if (
          classRow.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `Student cannot be enrolled because ${classRow.name} is not active.`,
          );
        }

        const studentGender =
          String(
            student.gender ??
              "",
          )
            .trim()
            .toLowerCase();

        if (
          [
            "male",
            "female",
          ].includes(
            studentGender,
          ) &&
          !classRow.name
            .toLowerCase()
            .includes(
              `(${studentGender})`,
            )
        ) {
          throw new ApiError(
            409,
            `Please select a ${student.gender} class for ${student.first_name} ${student.last_name}.`,
          );
        }

        const capacity =
          Number(
            classRow.capacity,
          );

        if (
          !Number.isInteger(
            capacity,
          ) ||
          capacity < 1
        ) {
          throw new ApiError(
            409,
            "This class does not have a valid capacity.",
          );
        }

        if (
          requestedStatus ===
          "active"
        ) {
          const classCount =
            await first<{
              total: number;
            }>(
              `select
                 count(*) as total
               from enrolments
               where
                 class_id = ?
                 and status = 'active'
                 and id != coalesce(?, '')`,
              classId,
              transferFromId,
            );

          if (
            Number(
              classCount?.total ??
                0,
            ) >=
            capacity
          ) {
            throw new ApiError(
              409,
              `The class ${classRow.name} is already full.`,
            );
          }
        }

        const activeElsewhere =
          await first<{
            id: string;
            class_id: string;
            class_name: string;
          }>(
            `select
               e.id,
               e.class_id,
               c.name as class_name
             from enrolments e
             join classes c
               on c.id = e.class_id
             where
               e.student_id = ?
               and e.status = 'active'
               and e.id != coalesce(?, '')
             limit 1`,
            studentId,
            transferFromId,
          );

        if (
          requestedStatus ===
            "active" &&
          activeElsewhere &&
          !transferFromId
        ) {
          throw new ApiError(
            409,
            `${student.first_name} ${student.last_name} is already actively enrolled in ${activeElsewhere.class_name}. Use Transfer class instead.`,
          );
        }

        let transferFrom:
          {
            id: string;
            student_id: string;
            class_id: string;
            status: string;
            class_name: string;
          } | null = null;

        if (
          transferFromId
        ) {
          transferFrom =
            await first<{
              id: string;
              student_id: string;
              class_id: string;
              status: string;
              class_name: string;
            }>(
              `select
                 e.id,
                 e.student_id,
                 e.class_id,
                 e.status,
                 c.name as class_name
               from enrolments e
               join classes c
                 on c.id = e.class_id
               where e.id = ?
               limit 1`,
              transferFromId,
            );

          if (!transferFrom) {
            throw new ApiError(
              404,
              "The current enrolment could not be found.",
            );
          }

          if (
            transferFrom.student_id !==
            studentId
          ) {
            throw new ApiError(
              409,
              "The selected enrolment does not belong to this student.",
            );
          }

          if (
            transferFrom.status !==
            "active"
          ) {
            throw new ApiError(
              409,
              "Only an active enrolment can be transferred.",
            );
          }

          if (
            transferFrom.class_id ===
            classId
          ) {
            throw new ApiError(
              409,
              "Please choose a different destination class.",
            );
          }

          if (
            activeElsewhere &&
            activeElsewhere.id !==
              transferFrom.id
          ) {
            throw new ApiError(
              409,
              `${student.first_name} ${student.last_name} already has another active enrolment in ${activeElsewhere.class_name}.`,
            );
          }
        }

        const existingTarget =
          await first<{
            id: string;
            status: string;
          }>(
            `select
               id,
               status
             from enrolments
             where
               student_id = ?
               and class_id = ?
             limit 1`,
            studentId,
            classId,
          );

        if (
          existingTarget?.status ===
          "active"
        ) {
          throw new ApiError(
            409,
            `${student.first_name} ${student.last_name} is already enrolled in ${classRow.name}.`,
          );
        }

        if (
          transferFrom
        ) {
          const targetId =
            existingTarget?.id ??
            id;

          const targetStatement =
            existingTarget
              ? d1()
                  .prepare(
                    `update enrolments
                     set
                       status = 'active',
                       enrolled_at = ?,
                       updated_at = CURRENT_TIMESTAMP
                     where id = ?`,
                  )
                  .bind(
                    enrolledAt,
                    existingTarget.id,
                  )
              : d1()
                  .prepare(
                    `insert into enrolments
                       (
                         id,
                         student_id,
                         class_id,
                         status,
                         enrolled_at
                       )
                     values (?, ?, ?, 'active', ?)`,
                  )
                  .bind(
                    targetId,
                    studentId,
                    classId,
                    enrolledAt,
                  );

          await d1().batch([
            targetStatement,
            d1()
              .prepare(
                `update enrolments
                 set
                   status = 'withdrawn',
                   updated_at = CURRENT_TIMESTAMP
                 where id = ?`,
              )
              .bind(
                transferFrom.id,
              ),
          ]);

          row =
            await first(
              `select *
               from enrolments
               where id = ?
               limit 1`,
              targetId,
            );

          await audit(
            who,
            "transfer-enrolment",
            "enrolments",
            targetId,
            {
              studentId,
              studentName:
                `${student.first_name} ${student.last_name}`,
              fromClassId:
                transferFrom.class_id,
              fromClassName:
                transferFrom.class_name,
              toClassId:
                classId,
              toClassName:
                classRow.name,
              enrolledAt,
            },
          );

          return json(
            {
              ok: true,
              data: row,
            },
            200,
          );
        }

        if (existingTarget) {
          row = await first(
            `update enrolments
             set
               status = ?,
               enrolled_at = ?,
               updated_at =
                 CURRENT_TIMESTAMP
             where id = ?
             returning *`,
            requestedStatus,
            enrolledAt,
            existingTarget.id,
          );

          if (!row) {
            throw new ApiError(
              500,
              "The enrolment could not be updated.",
            );
          }

          await audit(
            who,
            "reactivate-enrolment",
            "enrolments",
            existingTarget.id,
            {
              studentId,
              studentName:
                `${student.first_name} ${student.last_name}`,
              classId,
              className:
                classRow.name,
              status:
                requestedStatus,
              enrolledAt,
            },
          );

          return json(
            {
              ok: true,
              data: row,
            },
            200,
          );
        }

        row = await first(
          `insert into enrolments
             (
               id,
               student_id,
               class_id,
               status,
               enrolled_at
             )
           values (?, ?, ?, ?, ?)
           returning *`,
          id,
          studentId,
          classId,
          requestedStatus,
          enrolledAt,
        );

        if (!row) {
          throw new ApiError(
            500,
            "The enrolment could not be created.",
          );
        }

        await audit(
          who,
          "create-enrolment",
          "enrolments",
          String(
            row.id ??
              id,
          ),
          {
            studentId,
            studentName:
              `${student.first_name} ${student.last_name}`,
            classId,
            className:
              classRow.name,
            status:
              requestedStatus,
            enrolledAt,
            capacity,
          },
        );

        return json(
          {
            ok: true,
            data: row,
          },
          201,
        );
      }

      case "compliance":
        row = await first(
          `insert into compliance
             (
               id,
               user_id,
               check_type,
               status,
               completed_at,
               expires_at,
               notes
             )
           values (
             ?, ?, ?, ?, ?, ?, ?
           )
           returning *`,
          id,
          required(
            x.userId,
            "Staff member",
          ),
          required(
            x.checkType,
            "Check type",
          ),
          required(
            x.status,
            "Status",
          ),
          optional(
            x.completedAt,
          ),
          optional(
            x.expiresAt,
          ),
          optional(
            x.notes,
          ),
        );

        break;

      case "staff": {
        const email = required(
          x.email,
          "Email",
        ).toLowerCase();

        const displayName = required(
          x.displayName,
          "Display name",
        );

        const allowedStaffRoles = [
          "admin",
          "teacher",
          "finance",
          "safeguarding",
        ];

        const requestedRolesRaw =
          Array.isArray(
            x.roles,
          )
            ? x.roles
            : [
                required(
                  x.role,
                  "Role",
                ),
              ];

        const requestedRoles: string[] =
          Array.from(
            new Set<string>(
              requestedRolesRaw
                .map(
                  (value) =>
                    String(
                      value,
                    )
                      .trim()
                      .toLowerCase(),
                )
                .filter(
                  Boolean,
                ),
            ),
          );

        if (
          !requestedRoles.length ||
          requestedRoles.some(
            (role) =>
              !allowedStaffRoles.includes(
                role,
              ),
          )
        ) {
          throw new ApiError(
            400,
            "Select at least one valid staff role.",
          );
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
          throw new ApiError(
            400,
            "Enter a valid email address.",
          );
        }

        const existing =
          await first<{
            id: string;
            display_name: string;
            status: string;
          }>(
            `select
               id,
               display_name,
               status
             from users
             where lower(email) = lower(?)
             limit 1`,
            email,
          );

        if (existing) {
          const currentRoles =
            await all<{
              role: string;
            }>(
              `select role
               from user_roles
               where user_id = ?`,
              existing.id,
            );

          const currentRoleSet =
            new Set(
              currentRoles.map(
                (entry) =>
                  String(
                    entry.role,
                  ).toLowerCase(),
              ),
            );

          const rolesToAdd =
            requestedRoles.filter(
              (role) =>
                !currentRoleSet.has(
                  role,
                ),
            );

          if (!rolesToAdd.length) {
            throw new ApiError(
              409,
              "This portal account already has the selected staff access.",
            );
          }

          const db =
            d1();

          await db.batch([
            ...rolesToAdd.map(
              (role) =>
                db
                  .prepare(
                    `insert or ignore into user_roles
                       (user_id, role)
                     values (?, ?)`,
                  )
                  .bind(
                    existing.id,
                    role,
                  ),
            ),
            db
              .prepare(
                `update users
                 set
                   status = 'active',
                   updated_at = CURRENT_TIMESTAMP
                 where id = ?`,
              )
              .bind(
                existing.id,
              ),
          ]);

          row =
            await first(
              `select
                 u.id,
                 u.email,
                 u.display_name,
                 u.role,
                 u.status,
                 (
                   select group_concat(ur.role, ', ')
                   from user_roles ur
                   where ur.user_id = u.id
                 ) as roles
               from users u
               where u.id = ?
               limit 1`,
              existing.id,
            );

          await audit(
            who,
            "add-staff-role",
            "staff",
            existing.id,
            {
              rolesAdded:
                rolesToAdd,
              existingAccount:
                true,
            },
          );

          return json(
            {
              ok: true,
              data: row,
              existingAccount: true,
              message:
                "Existing portal account found. The selected staff access has been added without changing the existing password or parent access.",
            },
            200,
          );
        }

        const password = required(
          x.password,
          "Temporary password",
        );

        const primaryRole =
          requestedRoles[0];

        const db =
          d1();

        await db.batch([
          db
            .prepare(
              `insert into users
                 (
                   id,
                   email,
                   display_name,
                   password_hash,
                   role,
                   status
                 )
               values (
                 ?, ?, ?, ?, ?,
                 'active'
               )`,
            )
            .bind(
              id,
              email,
              displayName,
              await hash(
                password,
                12,
              ),
              primaryRole,
            ),
          ...requestedRoles.map(
            (role) =>
              db
                .prepare(
                  `insert into user_roles
                     (user_id, role)
                   values (?, ?)`,
                )
                .bind(
                  id,
                  role,
                ),
          ),
        ]);

        row =
          await first(
            `select
               u.id,
               u.email,
               u.display_name,
               u.role,
               u.status,
               (
                 select group_concat(ur.role, ', ')
                 from user_roles ur
                 where ur.user_id = u.id
               ) as roles
             from users u
             where u.id = ?
             limit 1`,
            id,
          );

        break;
      }

      default:
        throw new ApiError(
          400,
          "Creation is not available for this resource",
        );
    }

    await audit(
      who,
      "create",
      resource,
      String(
        row?.id ??
          id,
      ),
    );

    return json(
      {
        ok: true,
        data: row,
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      resource: string;
    }>;
  },
) {
  try {
    const resource = getResource(
      (await params).resource,
    );

    const who =
      await actor(
        request,
        ["admin"],
      );

    const x =
      await body(request);

    const id =
      required(
        x.id,
        "ID",
      );

    if (
      resource ===
        "students" &&
      x.action ===
        "reinstate"
    ) {
      const classId =
        required(
          x.classId,
          "Class",
        );

      const returnDate =
        required(
          x.returnDate,
          "Return date",
        );

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          returnDate,
        )
      ) {
        throw new ApiError(
          400,
          "Return date must be in YYYY-MM-DD format.",
        );
      }

      const parsedReturnDate =
        new Date(
          `${returnDate}T00:00:00Z`,
        );

      if (
        Number.isNaN(
          parsedReturnDate.getTime(),
        ) ||
        parsedReturnDate
          .toISOString()
          .slice(0, 10) !==
          returnDate
      ) {
        throw new ApiError(
          400,
          "Return date is not a valid calendar date.",
        );
      }

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      if (
        returnDate >
        today
      ) {
        throw new ApiError(
          400,
          "Return date cannot be in the future.",
        );
      }

      const student =
        await first<{
          id: string;
          student_number: string;
          first_name: string;
          last_name: string;
          gender: string | null;
          status: string;
        }>(
          `select
             id,
             student_number,
             first_name,
             last_name,
             gender,
             status
           from students
           where id = ?
           limit 1`,
          id,
        );

      if (!student) {
        throw new ApiError(
          404,
          "Student not found.",
        );
      }

      if (
        student.status ===
        "active"
      ) {
        throw new ApiError(
          409,
          "This student is already active.",
        );
      }

      const classRow =
        await first<{
          id: string;
          name: string;
          capacity: number;
          status: string;
        }>(
          `select
             id,
             name,
             capacity,
             status
           from classes
           where id = ?
           limit 1`,
          classId,
        );

      if (!classRow) {
        throw new ApiError(
          404,
          "Class not found.",
        );
      }

      if (
        classRow.status !==
        "active"
      ) {
        throw new ApiError(
          409,
          "The selected class is not active.",
        );
      }

      const gender =
        String(
          student.gender ??
            "",
        )
          .trim()
          .toLowerCase();

      const classNameLower =
        classRow.name
          .toLowerCase();

      if (
        gender ===
          "male" &&
        classNameLower.includes(
          "(female)",
        )
      ) {
        throw new ApiError(
          409,
          "This student cannot be reinstated into a female class.",
        );
      }

      if (
        gender ===
          "female" &&
        classNameLower.includes(
          "(male)",
        )
      ) {
        throw new ApiError(
          409,
          "This student cannot be reinstated into a male class.",
        );
      }

      const activeClassCount =
        await first<{
          total: number;
        }>(
          `select
             count(*) as total
           from enrolments
           where
             class_id = ?
             and status = 'active'
             and student_id <> ?`,
          classId,
          id,
        );

      if (
        Number(
          activeClassCount?.total ??
            0,
        ) >=
        Number(
          classRow.capacity,
        )
      ) {
        throw new ApiError(
          409,
          `${classRow.name} is already full.`,
        );
      }

      const existingEnrolment =
        await first<{
          id: string;
        }>(
          `select id
           from enrolments
           where
             student_id = ?
             and class_id = ?
           limit 1`,
          id,
          classId,
        );

      const previousAgreement =
        await first<{
          fee_plan_id: string | null;
          monthly_amount_pence: number;
          discount_pence: number;
          billing_day: number;
          collection_method: string;
        }>(
          `select
             fee_plan_id,
             monthly_amount_pence,
             discount_pence,
             billing_day,
             collection_method
           from student_fee_agreements
           where student_id = ?
           order by
             updated_at desc,
             created_at desc
           limit 1`,
          id,
        );

      const preferredPlan =
        previousAgreement?.fee_plan_id
          ? await first<{
              id: string;
              name: string;
              amount_pence: number;
            }>(
              `select
                 id,
                 name,
                 amount_pence
               from fee_plans
               where
                 id = ?
                 and active = 1
                 and frequency = 'monthly'
               limit 1`,
              previousAgreement.fee_plan_id,
            )
          : null;

      const standardPlan =
        preferredPlan ??
        await first<{
          id: string;
          name: string;
          amount_pence: number;
        }>(
          `select
             id,
             name,
             amount_pence
           from fee_plans
           where
             active = 1
             and frequency = 'monthly'
           order by
             case
               when id =
                 'standard-monthly-30'
               then 0
               else 1
             end,
             created_at
           limit 1`,
        );

      if (!standardPlan) {
        throw new ApiError(
          409,
          "The standard monthly fee plan is not configured.",
        );
      }

      const monthlyAmountPence =
        Number(
          previousAgreement
            ?.monthly_amount_pence ??
            standardPlan.amount_pence,
        );

      const discountPence =
        Math.max(
          0,
          Number(
            previousAgreement
              ?.discount_pence ??
              0,
          ),
        );

      const billingDay =
        Math.min(
          28,
          Math.max(
            1,
            Number(
              previousAgreement
                ?.billing_day ??
                1,
            ),
          ),
        );

      const previousCollectionMethod =
        String(
          previousAgreement
            ?.collection_method ??
            "online",
        )
          .trim()
          .toLowerCase();

      const collectionMethod =
        [
          "direct_debit",
          "online",
        ].includes(
          previousCollectionMethod,
        )
          ? previousCollectionMethod
          : "online";

      const enrolmentId =
        existingEnrolment?.id ??
        crypto.randomUUID();

      const feeAgreementId =
        crypto.randomUUID();

      const db =
        d1();

      const statements = [
        db
          .prepare(
            `update students
             set
               status = 'active',
               updated_at =
                 CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
            `update enrolments
             set
               status = 'inactive',
               updated_at =
                 CURRENT_TIMESTAMP
             where
               student_id = ?
               and status = 'active'`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
            `update student_fee_agreements
             set
               status = 'inactive',
               ends_on =
                 coalesce(
                   ends_on,
                   date(?, '-1 day')
                 ),
               updated_at =
                 CURRENT_TIMESTAMP
             where
               student_id = ?
               and status = 'active'`,
          )
          .bind(
            returnDate,
            id,
          ),
      ];

      if (
        existingEnrolment
      ) {
        statements.push(
          db
            .prepare(
              `update enrolments
               set
                 status = 'active',
                 enrolled_at = ?,
                 updated_at =
                   CURRENT_TIMESTAMP
               where id = ?`,
            )
            .bind(
              returnDate,
              enrolmentId,
            ),
        );
      } else {
        statements.push(
          db
            .prepare(
              `insert into enrolments
                 (
                   id,
                   student_id,
                   class_id,
                   enrolled_at,
                   status
                 )
               values (
                 ?, ?, ?, ?, 'active'
               )`,
            )
            .bind(
              enrolmentId,
              id,
              classId,
              returnDate,
            ),
        );
      }

      statements.push(
        db
          .prepare(
            `insert into student_fee_agreements
               (
                 id,
                 student_id,
                 fee_plan_id,
                 monthly_amount_pence,
                 discount_pence,
                 billing_day,
                 starts_on,
                 ends_on,
                 collection_method,
                 status
               )
             values (
               ?, ?, ?, ?, ?, ?,
               ?, null, ?, 'active'
             )`,
          )
          .bind(
            feeAgreementId,
            id,
            standardPlan.id,
            monthlyAmountPence,
            discountPence,
            billingDay,
            returnDate,
            collectionMethod,
          ),
      );

      statements.push(
        db
          .prepare(
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
            "reinstate-student",
            "students",
            id,
            JSON.stringify({
              studentNumber:
                student.student_number,
              studentName:
                `${student.first_name} ${student.last_name}`,
              previousStatus:
                student.status,
              classId,
              className:
                classRow.name,
              returnDate,
              feeAgreementId,
              feePlanId:
                standardPlan.id,
              feePlanName:
                standardPlan.name,
              monthlyAmountPence,
              discountPence,
              billingDay,
              collectionMethod,
            }),
          ),
      );

      await db.batch(
        statements,
      );

      const row =
        await first(
          `select
             s.*,
             s.first_name || ' ' ||
             s.last_name as name,
             ? as class_id,
             ? as class_name,
             'active' as enrolment_status
           from students s
           where s.id = ?
           limit 1`,
          classId,
          classRow.name,
          id,
        );

      return json({
        ok: true,
        data: row,
        message:
          `${student.first_name} ${student.last_name} has been reinstated to ${classRow.name}.`,
      });
    }

    if (
      resource ===
      "guardians"
    ) {
      const currentGuardian = await first<{
        id: string;
        user_id: string | null;
      }>(
        `select id, user_id
         from guardians
         where id = ?
         limit 1`,
        id,
      );

      if (!currentGuardian) {
        return json(
          {
            ok: false,
            error: "Record not found",
          },
          404,
        );
      }

      const email = required(
        x.email,
        "Email",
      ).toLowerCase();

      const duplicate = await first<{ id: string }>(
        `select id
         from guardians
         where lower(email) = lower(?)
           and id <> ?
         limit 1`,
        email,
        id,
      );

      if (duplicate) {
        throw new ApiError(
          409,
          "Another guardian already uses this email address.",
        );
      }

      if (currentGuardian.user_id) {
        const duplicateUser = await first<{ id: string }>(
          `select id
           from users
           where lower(email) = lower(?)
             and id <> ?
           limit 1`,
          email,
          currentGuardian.user_id,
        );

        if (duplicateUser) {
          throw new ApiError(
            409,
            "Another portal account already uses this email address.",
          );
        }
      }

      const row = await first(
        `update guardians
         set
           full_name = ?,
           email = ?,
           phone = ?,
           address = ?,
           postcode = ?,
           emergency_contact_number = ?,
           relationship = ?,
           updated_at = CURRENT_TIMESTAMP
         where id = ?
         returning *`,
        required(
          x.fullName,
          "Full name",
        ),
        email,
        required(
          x.phone,
          "Phone",
        ),
        optional(
          x.address,
        ),
        optional(
          x.postcode,
        ),
        optional(
          x.emergencyContactNumber,
        ),
        required(
          x.relationship,
          "Relationship",
        ),
        id,
      );

      if (!row) {
        return json(
          {
            ok: false,
            error: "Record not found",
          },
          404,
        );
      }

      if (currentGuardian.user_id) {
        await execute(
          `update users
           set
             display_name = ?,
             email = ?,
             updated_at = CURRENT_TIMESTAMP
           where id = ?`,
          required(
            x.fullName,
            "Full name",
          ),
          email,
          currentGuardian.user_id,
        );
      }

      await audit(
        who,
        "update",
        "guardians",
        id,
        {
          email,
        },
      );

      return json({
        ok: true,
        data: row,
      });
    }

    if (
      resource ===
      "classes" &&
      x.name !== undefined
    ) {
      const className =
        required(
          x.name,
          "Class name",
        )
          .replace(/\s+/g, " ")
          .trim();

      if (className.length > 100) {
        throw new ApiError(
          400,
          "Class name must be 100 characters or fewer.",
        );
      }

      const categoryId =
        required(
          x.categoryId,
          "Category",
        );

      const category =
        await first<{
          id: string;
          name: string;
        }>(
          `select id, name
           from class_categories
           where id = ?
             and status = 'active'
           limit 1`,
          categoryId,
        );

      if (!category) {
        throw new ApiError(
          400,
          "Please select an active category.",
        );
      }

      const duplicate = await first<{ id: string }>(
        `select id
         from classes
         where lower(name) = lower(?)
           and id <> ?
           and status = 'active'
         limit 1`,
        className,
        id,
      );

      if (duplicate) {
        throw new ApiError(
          409,
          `${className} already exists.`,
        );
      }

      const teacherId = optional(
        x.teacherId,
      );

      if (teacherId) {
        const teacher = await first<{ id: string }>(
          `select u.id
           from users u
           where u.id = ?
             and u.status = 'active'
             and exists (
               select 1
               from user_roles ur
               where ur.user_id = u.id
                 and ur.role = 'teacher'
             )
           limit 1`,
          teacherId,
        );

        if (!teacher) {
          throw new ApiError(
            400,
            "Please select an active teacher account.",
          );
        }
      }

      const row = await first(
        `update classes
         set
           name = ?,
           subject = ?,
           level = ?,
           category_id = ?,
           teacher_id = ?,
           room = ?,
           day_of_week = ?,
           start_time = ?,
           end_time = ?,
           capacity = ?,
           updated_at = CURRENT_TIMESTAMP
         where id = ?
         returning *`,
        className,
        required(x.subject, "Subject"),
        category.name,
        category.id,
        teacherId,
        required(x.room, "Room"),
        integer(x.dayOfWeek, "Day", 0),
        required(x.startTime, "Start time"),
        required(x.endTime, "End time"),
        integer(x.capacity, "Capacity", 1),
        id,
      );

      if (!row) {
        return json(
          { ok: false, error: "Record not found" },
          404,
        );
      }

      await audit(
        who,
        "update-class",
        "classes",
        id,
        {
          className,
          categoryId: category.id,
          categoryName: category.name,
          teacherId,
        },
      );

      return json({ ok: true, data: row });
    }

    if (
      resource ===
        "staff" &&
      x.status !== undefined &&
      x.displayName === undefined
    ) {
      const nextStatus = required(
        x.status,
        "Status",
      ).toLowerCase();

      if (!["active", "inactive", "pending"].includes(nextStatus)) {
        throw new ApiError(
          400,
          "Select a valid staff status.",
        );
      }

      if (id === who.id && nextStatus !== "active") {
        throw new ApiError(
          409,
          "You cannot deactivate or archive your own account.",
        );
      }

      const current = await first<{
        status: string;
        has_admin: number;
      }>(
        `select
           u.status,
           exists (
             select 1
             from user_roles ur
             where ur.user_id = u.id
               and ur.role = 'admin'
           ) as has_admin
         from users u
         where u.id = ?
         limit 1`,
        id,
      );

      if (!current) {
        return json(
          { ok: false, error: "Record not found" },
          404,
        );
      }

      if (
        Number(current.has_admin) === 1 &&
        current.status === "active" &&
        nextStatus !== "active"
      ) {
        const activeAdmins = await first<{ count: number }>(
          `select count(distinct u.id) as count
           from users u
           join user_roles ur
             on ur.user_id = u.id
            and ur.role = 'admin'
           where u.status = 'active'`,
        );

        if (Number(activeAdmins?.count ?? 0) <= 1) {
          throw new ApiError(
            409,
            "The final active administrator cannot be archived or deactivated.",
          );
        }
      }

      const row = await first(
        `update users
         set status = ?,
             updated_at = CURRENT_TIMESTAMP
         where id = ?
         returning id, email, display_name, role, status`,
        nextStatus,
        id,
      );

      await audit(
        who,
        "update-status",
        "staff",
        id,
        { status: nextStatus },
      );

      return json({ ok: true, data: row });
    }

    if (
      resource ===
      "staff"
    ) {
      const displayName = required(
        x.displayName,
        "Display name",
      );

      const email = required(
        x.email,
        "Email",
      ).toLowerCase();

      const password = optional(
        x.password,
      );

      const allowedStaffRoles = [
        "admin",
        "teacher",
        "finance",
        "safeguarding",
      ];

      const requestedRolesRaw =
        Array.isArray(
          x.roles,
        )
          ? x.roles
          : [
              required(
                x.role,
                "Role",
              ),
            ];

      const requestedRoles: string[] =
        Array.from(
          new Set<string>(
            requestedRolesRaw
              .map(
                (value) =>
                  String(
                    value,
                  )
                    .trim()
                    .toLowerCase(),
              )
              .filter(
                Boolean,
              ),
          ),
        );

      if (
        !requestedRoles.length ||
        requestedRoles.some(
          (role) =>
            !allowedStaffRoles.includes(
              role,
            ),
        )
      ) {
        throw new ApiError(
          400,
          "Select at least one valid staff role.",
        );
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new ApiError(
          400,
          "Enter a valid email address.",
        );
      }

      const current =
        await first<{
          id: string;
          role: string;
          status: string;
        }>(
          `select
             id,
             role,
             status
           from users
           where id = ?
           limit 1`,
          id,
        );

      if (!current) {
        return json(
          {
            ok: false,
            error: "Record not found",
          },
          404,
        );
      }

      const currentRoles =
        await all<{
          role: string;
        }>(
          `select role
           from user_roles
           where user_id = ?`,
          id,
        );

      const currentRoleSet =
        new Set(
          currentRoles.map(
            (entry) =>
              String(
                entry.role,
              ).toLowerCase(),
          ),
        );

      if (
        id === who.id &&
        currentRoleSet.has(
          "admin",
        ) &&
        !requestedRoles.includes(
          "admin",
        )
      ) {
        throw new ApiError(
          409,
          "Use another administrator account to remove your own administrator role.",
        );
      }

      if (
        currentRoleSet.has(
          "admin",
        ) &&
        !requestedRoles.includes(
          "admin",
        ) &&
        current.status ===
          "active"
      ) {
        const activeAdmins =
          await first<{
            total: number;
          }>(
            `select
               count(distinct u.id) as total
             from users u
             join user_roles ur
               on ur.user_id = u.id
              and ur.role = 'admin'
             where u.status = 'active'`,
          );

        if (
          Number(
            activeAdmins?.total ??
              0,
          ) <= 1
        ) {
          throw new ApiError(
            409,
            "The final active administrator cannot lose administrator access.",
          );
        }
      }

      const duplicate =
        await first<{
          id: string;
        }>(
          `select id
           from users
           where lower(email) = lower(?)
             and id <> ?
           limit 1`,
          email,
          id,
        );

      if (duplicate) {
        throw new ApiError(
          409,
          "Another portal account already uses this email address.",
        );
      }

      const hasParentRole =
        currentRoleSet.has(
          "parent",
        );

      const legacyRole =
        hasParentRole
          ? "parent"
          : requestedRoles[0];

      const db =
        d1();

      const statements = [
        ...requestedRoles.map(
          (role) =>
            db
              .prepare(
                `insert or ignore into user_roles
                   (user_id, role)
                 values (?, ?)`,
              )
              .bind(
                id,
                role,
              ),
        ),
        db
          .prepare(
            `delete from user_roles
             where user_id = ?
               and role in (
                 'admin',
                 'teacher',
                 'finance',
                 'safeguarding'
               )
               and role not in (
                 ${requestedRoles.map(() => "?").join(", ")}
               )`,
          )
          .bind(
            id,
            ...requestedRoles,
          ),
      ];

      if (password) {
        statements.push(
          db
            .prepare(
              `update users
               set
                 display_name = ?,
                 email = ?,
                 role = ?,
                 password_hash = ?,
                 updated_at = CURRENT_TIMESTAMP
               where id = ?`,
            )
            .bind(
              displayName,
              email,
              legacyRole,
              await hash(
                password,
                12,
              ),
              id,
            ),
        );
      } else {
        statements.push(
          db
            .prepare(
              `update users
               set
                 display_name = ?,
                 email = ?,
                 role = ?,
                 updated_at = CURRENT_TIMESTAMP
               where id = ?`,
            )
            .bind(
              displayName,
              email,
              legacyRole,
              id,
            ),
        );
      }

      await db.batch(
        statements,
      );

      const row =
        await first(
          `select
             u.id,
             u.email,
             u.display_name,
             u.role,
             u.status,
             (
               select group_concat(ur.role, ', ')
               from user_roles ur
               where ur.user_id = u.id
             ) as roles
           from users u
           where u.id = ?
           limit 1`,
          id,
        );

      await audit(
        who,
        "update-profile",
        "staff",
        id,
        {
          email,
          roles:
            requestedRoles,
          parentAccessPreserved:
            hasParentRole,
        },
      );

      return json({
        ok: true,
        data: row,
      });
    }

    if (
      resource ===
      "applications"
    ) {
      const nextStatus =
        applicationStatus(
          x.status,
        );

      const reviewNotes =
        optional(
          x.reviewNotes,
        ) ??
        optional(
          x.reviewNote,
        ) ??
        null;

      const current =
        await first<{
          id: string;
          student_id: string;
          status: string;
          gender: string;
        }>(
          `select
             a.id,
             a.student_id,
             a.status,
             s.gender
           from applications a
           join students s
             on s.id = a.student_id
           where a.id = ?
           limit 1`,
          id,
        );

      if (!current) {
        return json(
          {
            ok: false,
            error:
              "Record not found",
          },
          404,
        );
      }

      const currentStatus =
        applicationStatus(
          current.status,
        );

      assertApplicationTransition(
        currentStatus,
        nextStatus,
      );

      if (
        nextStatus ===
          "rejected" &&
        !reviewNotes
      ) {
        throw new ApiError(
          400,
          "Review notes are required when rejecting an application",
        );
      }

      const studentStatus =
        applicationStudentStatus(
          nextStatus,
        );

      let admissionClass: {
        id: string;
        name: string;
        capacity: number;
        status: string;
      } | null = null;

      let enrolment: {
        id: string;
        status: string;
      } | null = null;

      if (
        nextStatus ===
        "accepted"
      ) {
        const classId =
          required(
            x.classId,
            "Class",
          );

        admissionClass =
          await first<{
            id: string;
            name: string;
            capacity: number;
            status: string;
          }>(
            `select
               id,
               name,
               capacity,
               status
             from classes
             where id = ?
             limit 1`,
            classId,
          );

        if (!admissionClass) {
          throw new ApiError(
            404,
            "Class not found",
          );
        }

        if (
          admissionClass.status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `The class ${admissionClass.name} is not active.`,
          );
        }

        const studentGender =
          String(
            current.gender ??
              "",
          ).toLowerCase();

        if (
          [
            "male",
            "female",
          ].includes(
            studentGender,
          ) &&
          !admissionClass.name
            .toLowerCase()
            .includes(
              `(${studentGender})`,
            )
        ) {
          throw new ApiError(
            409,
            `Please select a ${current.gender} class for this student.`,
          );
        }

        const activeEnrolment =
          await first<{
            id: string;
            class_id: string;
            class_name: string;
          }>(
            `select
               e.id,
               e.class_id,
               c.name as class_name
             from enrolments e
             join classes c
               on c.id = e.class_id
             where
               e.student_id = ?
               and e.status = 'active'
             limit 1`,
            current.student_id,
          );

        if (
          activeEnrolment &&
          activeEnrolment.class_id !==
            classId
        ) {
          throw new ApiError(
            409,
            `This student is already enrolled in ${activeEnrolment.class_name}.`,
          );
        }

        enrolment =
          await first<{
            id: string;
            status: string;
          }>(
            `select
               id,
               status
             from enrolments
             where
               student_id = ?
               and class_id = ?
             limit 1`,
            current.student_id,
            classId,
          );

        if (!activeEnrolment) {
          const classCount =
            await first<{
              total: number;
            }>(
              `select
                 count(*) as total
               from enrolments
               where
                 class_id = ?
                 and status = 'active'`,
              classId,
            );

          if (
            Number(
              classCount?.total ??
                0,
            ) >=
            Number(
              admissionClass.capacity,
            )
          ) {
            throw new ApiError(
              409,
              `The class ${admissionClass.name} is already full.`,
            );
          }
        }
      }

      let standardFeePlan: {
        id: string;
        name: string;
      } | null = null;

      let feeAgreementId:
        string | null = null;

      let createFeeAgreement =
        false;

      const feeStartDate =
        new Date()
          .toISOString()
          .slice(0, 10);

      if (
        nextStatus ===
        "accepted"
      ) {
        standardFeePlan =
          await first<{
            id: string;
            name: string;
          }>(
            `select id, name
             from fee_plans
             where
               active = 1
               and frequency = 'monthly'
             order by
               case when id = 'standard-monthly-30' then 0 else 1 end,
               created_at
             limit 1`,
          );

        if (!standardFeePlan) {
          throw new ApiError(
            409,
            "The standard £30 monthly fee has not been configured.",
          );
        }

        const existingAgreement =
          await first<{
            id: string;
          }>(
            `select id
             from student_fee_agreements
             where
               student_id = ?
               and status = 'active'
             order by created_at
             limit 1`,
            current.student_id,
          );

        feeAgreementId =
          existingAgreement?.id ??
          crypto.randomUUID();

        createFeeAgreement =
          !existingAgreement;
      }

      const auditDetails =
        JSON.stringify({
          previousStatus:
            currentStatus,
          status:
            nextStatus,
          studentStatus,
          reviewNotes,
          classId:
            admissionClass?.id ??
            null,
          className:
            admissionClass?.name ??
            null,
          monthlyFeePence:
            nextStatus === "accepted"
              ? 3000
              : null,
          feePlan:
            standardFeePlan?.name ??
            null,
        });

      const db = d1();

      const applicationUpdate =
        db
          .prepare(
            `update applications
             set
               status = ?,
               reviewed_by = ?,
               review_notes =
                 coalesce(
                   ?,
                   review_notes
                 ),
               updated_at =
                 CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            nextStatus,
            who.id,
            reviewNotes,
            id,
          );

      const studentUpdate =
        db
          .prepare(
            `update students
             set
               status = ?,
               updated_at =
                 CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            studentStatus,
            current.student_id,
          );

      const auditInsert =
        db
          .prepare(
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
            "application-status-transition",
            "applications",
            id,
            auditDetails,
          );

      if (
        nextStatus ===
          "accepted" &&
        admissionClass
      ) {
        const enrolmentId =
          enrolment?.id ??
          crypto.randomUUID();

        const enrolmentWrite =
          enrolment
            ? db
                .prepare(
                  `update enrolments
                   set
                     status = 'active',
                     enrolled_at =
                       CURRENT_TIMESTAMP,
                     updated_at =
                       CURRENT_TIMESTAMP
                   where id = ?`,
                )
                .bind(
                  enrolmentId,
                )
            : db
                .prepare(
                  `insert into enrolments
                     (
                       id,
                       student_id,
                       class_id,
                       status
                     )
                   values (
                     ?, ?, ?, 'active'
                   )`,
                )
                .bind(
                  enrolmentId,
                  current.student_id,
                  admissionClass.id,
                );

        const acceptanceStatements = [
          applicationUpdate,
          studentUpdate,
          enrolmentWrite,
        ];

        if (
          createFeeAgreement &&
          feeAgreementId &&
          standardFeePlan
        ) {
          acceptanceStatements.push(
            db
              .prepare(
                `insert into student_fee_agreements
                   (
                     id,
                     student_id,
                     fee_plan_id,
                     monthly_amount_pence,
                     discount_pence,
                     billing_day,
                     starts_on,
                     ends_on,
                     collection_method,
                     status
                   )
                 values (
                   ?, ?, ?, 3000, 0, 1,
                   ?, null, 'online', 'active'
                 )`,
              )
              .bind(
                feeAgreementId,
                current.student_id,
                standardFeePlan.id,
                feeStartDate,
              ),
          );
        }

        if (
          feeAgreementId &&
          standardFeePlan
        ) {
          const billingYear =
            Number(
              feeStartDate.slice(0, 4),
            );
          const billingMonth =
            Number(
              feeStartDate.slice(5, 7),
            );

          acceptanceStatements.push(
            db
              .prepare(
                `insert or ignore into fee_invoices
                   (
                     id,
                     student_id,
                     agreement_id,
                     billing_year,
                     billing_month,
                     description,
                     amount_pence,
                     discount_pence,
                     amount_due_pence,
                     amount_paid_pence,
                     due_date,
                     status
                   )
                 values (
                   ?, ?, ?, ?, ?, ?,
                   3000, 0, 3000, 0, ?,
                   'pending'
                 )`,
              )
              .bind(
                crypto.randomUUID(),
                current.student_id,
                feeAgreementId,
                billingYear,
                billingMonth,
                `${standardFeePlan.name} - ${new Intl.DateTimeFormat(
                  "en-GB",
                  {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                ).format(new Date(`${feeStartDate}T00:00:00Z`))}`,
                feeStartDate,
              ),
          );
        }

        acceptanceStatements.push(
          auditInsert,
        );

        await db.batch(
          acceptanceStatements,
        );
      } else if (
        currentStatus ===
        "accepted"
      ) {
        const enrolmentDeactivate =
          db
            .prepare(
              `update enrolments
               set
                 status = 'inactive',
                 updated_at =
                   CURRENT_TIMESTAMP
               where
                 student_id = ?
                 and status = 'active'`,
            )
            .bind(
              current.student_id,
            );

        const feeAgreementDeactivate =
          db
            .prepare(
              `update student_fee_agreements
               set
                 status = 'inactive',
                 ends_on =
                   coalesce(
                     ends_on,
                     date('now')
                   ),
                 updated_at =
                   CURRENT_TIMESTAMP
               where
                 student_id = ?
                 and status = 'active'`,
            )
            .bind(
              current.student_id,
            );

        await db.batch([
          applicationUpdate,
          studentUpdate,
          enrolmentDeactivate,
          feeAgreementDeactivate,
          auditInsert,
        ]);
      } else {
        await db.batch([
          applicationUpdate,
          studentUpdate,
          auditInsert,
        ]);
      }

      const parentAccess =
        nextStatus === "accepted"
          ? await provisionParentAccess(
              id,
              new URL(request.url).origin,
            )
          : null;

      const row =
        await first(
          `select
             a.*,
             s.student_number,
             s.first_name || ' ' ||
             s.last_name
               as student_name,
             s.status
               as student_status,
             g.full_name
               as guardian_name,
             g.email
               as guardian_email,
             g.phone
               as guardian_phone,
             reviewer.display_name
               as reviewer_name
           from applications a
           join students s
             on s.id =
                a.student_id
           left join student_guardians sg
             on sg.student_id =
                s.id
            and sg.is_primary = 1
           left join guardians g
             on g.id =
                sg.guardian_id
           left join users reviewer
             on reviewer.id =
                a.reviewed_by
           where
             a.id = ?
           limit 1`,
          id,
        );

      return json({
        ok: true,
        data: row,
        transition: {
          from:
            currentStatus,
          to:
            nextStatus,
        },
        parentAccess,
      });
    }

    if (
      resource ===
      "enrolments"
    ) {
      const status =
        required(
          x.status,
          "Status",
        )
          .trim()
          .toLowerCase();

      const allowedStatuses = [
        "active",
        "pending",
        "completed",
        "withdrawn",
      ];

      if (
        !allowedStatuses.includes(
          status,
        )
      ) {
        throw new ApiError(
          400,
          `Invalid enrolment status. Allowed values: ${allowedStatuses.join(", ")}`,
        );
      }

      const current =
        await first<{
          id: string;
          student_id: string;
          class_id: string;
          current_status: string;
          student_name: string;
          gender: string | null;
          class_name: string;
          class_status: string;
          capacity: number;
        }>(
          `select
             e.id,
             e.student_id,
             e.class_id,
             e.status as current_status,
             s.first_name || ' ' || s.last_name as student_name,
             s.gender,
             c.name as class_name,
             c.status as class_status,
             c.capacity
           from enrolments e
           join students s
             on s.id = e.student_id
           join classes c
             on c.id = e.class_id
           where e.id = ?
           limit 1`,
          id,
        );

      if (!current) {
        return json(
          {
            ok: false,
            error:
              "Record not found",
          },
          404,
        );
      }

      if (
        current.current_status ===
        status
      ) {
        throw new ApiError(
          409,
          `This enrolment is already ${status}.`,
        );
      }

      if (
        status ===
        "active"
      ) {
        if (
          current.class_status !==
          "active"
        ) {
          throw new ApiError(
            409,
            `${current.class_name} is not active.`,
          );
        }

        const studentGender =
          String(
            current.gender ??
              "",
          )
            .trim()
            .toLowerCase();

        if (
          [
            "male",
            "female",
          ].includes(
            studentGender,
          ) &&
          !current.class_name
            .toLowerCase()
            .includes(
              `(${studentGender})`,
            )
        ) {
          throw new ApiError(
            409,
            `This student cannot be activated in ${current.class_name} because the class does not match the student's gender.`,
          );
        }

        const activeElsewhere =
          await first<{
            id: string;
            class_name: string;
          }>(
            `select
               e.id,
               c.name as class_name
             from enrolments e
             join classes c
               on c.id = e.class_id
             where
               e.student_id = ?
               and e.status = 'active'
               and e.id != ?
             limit 1`,
            current.student_id,
            id,
          );

        if (
          activeElsewhere
        ) {
          throw new ApiError(
            409,
            `${current.student_name} is already actively enrolled in ${activeElsewhere.class_name}. Use Transfer class instead.`,
          );
        }

        const classCount =
          await first<{
            total: number;
          }>(
            `select
               count(*) as total
             from enrolments
             where
               class_id = ?
               and status = 'active'
               and id != ?`,
            current.class_id,
            id,
          );

        if (
          Number(
            classCount?.total ??
              0,
          ) >=
          Number(
            current.capacity,
          )
        ) {
          throw new ApiError(
            409,
            `The class ${current.class_name} is already full.`,
          );
        }
      }

      const row =
        await first(
          `update enrolments
           set
             status = ?,
             updated_at =
               CURRENT_TIMESTAMP
           where id = ?
           returning *`,
          status,
          id,
        );

      await audit(
        who,
        "update-enrolment-status",
        "enrolments",
        id,
        {
          studentId:
            current.student_id,
          studentName:
            current.student_name,
          classId:
            current.class_id,
          className:
            current.class_name,
          from:
            current.current_status,
          to:
            status,
        },
      );

      return json({
        ok: true,
        data: row,
      });
    }

    const status =
      required(
        x.status,
        "Status",
      );

    if (
      resource ===
        "students" &&
      status ===
        "inactive"
    ) {
      const current =
        await first<{
          id: string;
          student_number: string;
          first_name: string;
          last_name: string;
          status: string;
        }>(
          `select
             id,
             student_number,
             first_name,
             last_name,
             status
           from students
           where id = ?
           limit 1`,
          id,
        );

      if (!current) {
        return json(
          {
            ok: false,
            error:
              "Record not found",
          },
          404,
        );
      }

      const db =
        d1();

      await db.batch([
        db
          .prepare(
            `update students
             set
               status = 'inactive',
               updated_at =
                 CURRENT_TIMESTAMP
             where id = ?`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
            `update enrolments
             set
               status = 'inactive',
               updated_at =
                 CURRENT_TIMESTAMP
             where
               student_id = ?
               and status = 'active'`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
            `update student_fee_agreements
             set
               status = 'inactive',
               ends_on =
                 coalesce(
                   ends_on,
                   date('now')
                 ),
               updated_at =
                 CURRENT_TIMESTAMP
             where
               student_id = ?
               and status = 'active'`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
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
            "archive-student",
            "students",
            id,
            JSON.stringify({
              studentNumber:
                current.student_number,
              studentName:
                `${current.first_name} ${current.last_name}`,
              previousStatus:
                current.status,
              status:
                "inactive",
            }),
          ),
      ]);

      const row =
        await first(
          `select *
           from students
           where id = ?
           limit 1`,
          id,
        );

      return json({
        ok: true,
        data: row,
      });
    }

    if (
      resource ===
        "students" &&
      status ===
        "active"
    ) {
      const current =
        await first<{
          status: string;
        }>(
          `select status
           from students
           where id = ?
           limit 1`,
          id,
        );

      if (
        current?.status ===
        "inactive"
      ) {
        throw new ApiError(
          409,
          "Use Reinstate student so the class enrolment and billing setup are restored together.",
        );
      }
    }

    const patchable:
      Partial<
        Record<
          Resource,
          string
        >
      > = {
      students:
        "students",

      classes:
        "classes",

      attendance:
        "attendance",

      fees:
        "fees",

      enrolments:
        "enrolments",

      compliance:
        "compliance",

      announcements:
        "announcements",

      staff:
        "users",
    };

    const table =
      patchable[resource];

    if (!table) {
      throw new ApiError(
        400,
        `Status updates are not supported for ${resource}`,
      );
    }

    const row =
      await first(
        `update ${table}
         set
           status = ?,
           updated_at =
             CURRENT_TIMESTAMP
         where id = ?
         returning *`,
        status,
        id,
      );

    if (!row) {
      return json(
        {
          ok: false,
          error:
            "Record not found",
        },
        404,
      );
    }

    await audit(
      who,
      "update-status",
      resource,
      id,
      {
        status,
      },
    );

    return json({
      ok: true,
      data: row,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const resource =
      getResource(
        (await params).resource,
      );

    const who =
      await actor(
        request,
        ["admin"],
      );

    const url =
      new URL(
        request.url,
      );

    const id =
      url.searchParams.get(
        "id",
      );

    if (!id) {
      return json(
        {
          ok: false,
          error:
            "ID is required",
        },
        400,
      );
    }

    /*
     * STUDENT HARD DELETE
     *
     * Student operational records are removed.
     *
     * Financial transaction history is deliberately
     * retained, but detached from the student,
     * application, invoice or legacy fee being removed.
     *
     * Guardians and parent accounts are preserved
     * because they may belong to another student.
     */
    if (
      resource ===
      "students"
    ) {
      const confirmation =
        url.searchParams.get(
          "confirm",
        );

      if (
        confirmation !==
        "permanent"
      ) {
        throw new ApiError(
          400,
          "Permanent deletion must be explicitly confirmed.",
        );
      }

      const student =
        await first<{
          id: string;
          student_number: string;
          first_name: string;
          last_name: string;
        }>(
          `select
             id,
             student_number,
             first_name,
             last_name
           from students
           where id = ?
           limit 1`,
          id,
        );

      if (!student) {
        return json(
          {
            ok: false,
            error:
              "Student not found",
          },
          404,
        );
      }

      const db =
        d1();

      const deleteAuditDetails =
        JSON.stringify({
          studentNumber:
            student.student_number,

          studentName:
            `${student.first_name} ${student.last_name}`,

          financialHistory:
            "preserved-and-detached",

          guardianRecords:
            "preserved",
        });

      /*
       * D1 batch executes the detach, delete and audit
       * write as one atomic operation.
       *
       * If one statement fails, the whole batch rolls
       * back rather than leaving half-deleted records
       * or a deletion without an audit entry.
       */
      await db.batch([
        /*
         * New billing/payment engine.
         *
         * Retain provider transaction history but
         * detach anything belonging to this student.
         */
        db
          .prepare(
            `update payment_transactions
             set
               student_id = null,

               application_id =
                 case
                   when application_id in (
                     select id
                     from applications
                     where student_id = ?
                   )
                   then null
                   else application_id
                 end,

               invoice_id =
                 case
                   when invoice_id in (
                     select id
                     from fee_invoices
                     where student_id = ?
                   )
                   then null
                   else invoice_id
                 end,

               updated_at =
                 CURRENT_TIMESTAMP

             where
               student_id = ?

               or application_id in (
                 select id
                 from applications
                 where student_id = ?
               )

               or invoice_id in (
                 select id
                 from fee_invoices
                 where student_id = ?
               )`,
          )
          .bind(
            id,
            id,
            id,
            id,
            id,
          ),

        /*
         * Keep issued receipts for financial history,
         * but remove the deleted student relationship.
         */
        db
          .prepare(
            `update receipts
             set
               student_id = null,
               updated_at =
                 CURRENT_TIMESTAMP
             where student_id = ?`,
          )
          .bind(
            id,
          ),

        /*
         * Legacy payment system.
         *
         * The fee record will disappear with the
         * student, but the payment record remains.
         */
        db
          .prepare(
            `update payments
             set
               fee_id = null,
               updated_at =
                 CURRENT_TIMESTAMP
             where fee_id in (
               select id
               from fees
               where student_id = ?
             )`,
          )
          .bind(
            id,
          ),

        /*
         * This triggers the existing database cascades:
         *
         * - applications
         * - enrolments
         * - attendance
         * - progress
         * - student_guardians
         * - student_fee_agreements
         * - fee_invoices
         * - invoice allocations
         * - legacy fees
         *
         * Guardians are intentionally preserved.
         */
        db
          .prepare(
            `delete from students
             where id = ?`,
          )
          .bind(
            id,
          ),

        /*
         * Keep the permanent deletion audit record in
         * the same transaction as the destructive work.
         */
        db
          .prepare(
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
            "permanent-delete",
            "students",
            id,
            deleteAuditDetails,
          ),
      ]);

      return json({
        ok: true,

        deleted: {
          id:
            student.id,

          studentNumber:
            student.student_number,

          name:
            `${student.first_name} ${student.last_name}`,
        },
      });
    }

    /*
     * STAFF / ADMIN HARD DELETE
     *
     * - an administrator cannot delete their own account;
     * - the final active administrator cannot be deleted;
     * - class teacher references are preserved by becoming null;
     * - compliance and explicit permission records cascade away;
     * - historical audit and communication references are preserved
     *   by their existing SET NULL relationships.
     */
    if (
      resource ===
      "staff"
    ) {
      const confirmation =
        url.searchParams.get(
          "confirm",
        );

      if (
        confirmation !==
        "permanent"
      ) {
        throw new ApiError(
          400,
          "Permanent staff deletion must be explicitly confirmed.",
        );
      }

      if (
        id ===
        who.id
      ) {
        throw new ApiError(
          409,
          "You cannot permanently delete your own staff access. Use another administrator account.",
        );
      }

      const staff =
        await first<{
          id: string;
          email: string;
          display_name: string;
          status: string;
          has_parent: number;
          has_admin: number;
          roles: string | null;
        }>(
          `select
             u.id,
             u.email,
             u.display_name,
             u.status,
             exists (
               select 1
               from user_roles ur
               where ur.user_id = u.id
                 and ur.role = 'parent'
             ) as has_parent,
             exists (
               select 1
               from user_roles ur
               where ur.user_id = u.id
                 and ur.role = 'admin'
             ) as has_admin,
             (
               select group_concat(ur.role, ', ')
               from user_roles ur
               where ur.user_id = u.id
             ) as roles
           from users u
           where
             u.id = ?
             and exists (
               select 1
               from user_roles staff_role
               where staff_role.user_id = u.id
                 and staff_role.role in (
                   'admin',
                   'teacher',
                   'finance',
                   'safeguarding'
                 )
             )
           limit 1`,
          id,
        );

      if (!staff) {
        return json(
          {
            ok: false,
            error:
              "Staff account not found",
          },
          404,
        );
      }

      if (
        Number(
          staff.has_admin,
        ) === 1 &&
        staff.status ===
          "active"
      ) {
        const activeAdmins =
          await first<{
            total: number;
          }>(
            `select
               count(distinct u.id) as total
             from users u
             join user_roles ur
               on ur.user_id = u.id
              and ur.role = 'admin'
             where u.status = 'active'`,
          );

        if (
          Number(
            activeAdmins?.total ??
              0,
          ) <= 1
        ) {
          throw new ApiError(
            409,
            "The last active administrator cannot lose administrator access. Create or activate another administrator first.",
          );
        }
      }

      const db =
        d1();

      if (
        Number(
          staff.has_parent,
        ) === 1
      ) {
        await db.batch([
          db
            .prepare(
              `update classes
               set
                 teacher_id = null,
                 updated_at = CURRENT_TIMESTAMP
               where teacher_id = ?`,
            )
            .bind(
              id,
            ),

          db
            .prepare(
              `delete from compliance
               where user_id = ?`,
            )
            .bind(
              id,
            ),

          db
            .prepare(
              `delete from user_roles
               where user_id = ?
                 and role in (
                   'admin',
                   'teacher',
                   'finance',
                   'safeguarding'
                 )`,
            )
            .bind(
              id,
            ),

          db
            .prepare(
              `update users
               set
                 role = 'parent',
                 updated_at = CURRENT_TIMESTAMP
               where id = ?`,
            )
            .bind(
              id,
            ),

          db
            .prepare(
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
              "remove-staff-access",
              "staff",
              id,
              JSON.stringify({
                displayName:
                  staff.display_name,
                email:
                  staff.email,
                previousRoles:
                  staff.roles,
                parentAccess:
                  "preserved",
              }),
            ),
        ]);

        return json({
          ok: true,
          preservedParentAccount:
            true,
          removedStaffAccess: {
            id:
              staff.id,
            name:
              staff.display_name,
            email:
              staff.email,
          },
        });
      }

      await db.batch([
        db
          .prepare(
            `delete from users
             where id = ?`,
          )
          .bind(
            id,
          ),

        db
          .prepare(
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
            "permanent-delete",
            "staff",
            id,
            JSON.stringify({
              displayName:
                staff.display_name,
              email:
                staff.email,
              previousRoles:
                staff.roles,
              parentAccess:
                "not-applicable",
            }),
          ),
      ]);

      return json({
        ok: true,
        deleted: {
          id:
            staff.id,
          name:
            staff.display_name,
          email:
            staff.email,
          roles:
            staff.roles,
        },
      });
    }

    /*
     * Existing generic delete behaviour
     * for other manageable resources.
     */
    const table =
      resources[
        resource
      ].table;

    const row =
      await first<{
        id: string;
      }>(
        `delete from ${table}
         where id = ?
         returning id`,
        id,
      );

    if (!row) {
      return json(
        {
          ok: false,
          error:
            "Record not found",
        },
        404,
      );
    }

    await audit(
      who,
      "delete",
      resource,
      id,
    );

    return json({
      ok: true,
    });
  } catch (error) {
    return fail(
      error,
    );
  }
}