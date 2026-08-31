import { sql } from "@/db";
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
} from "@/lib/backend";

const resources = {
  students: { table: "students", roles: ["admin", "teacher", "safeguarding"] },
  guardians: { table: "guardians", roles: ["admin", "safeguarding"] },
  applications: { table: "applications", roles: ["admin"] },
  classes: { table: "classes", roles: ["admin", "teacher"] },
  attendance: { table: "attendance", roles: ["admin", "teacher"] },
  progress: { table: "progress", roles: ["admin", "teacher", "parent"] },
  fees: { table: "fees", roles: ["admin", "finance", "parent"] },
  payments: { table: "payments", roles: ["admin", "finance"] },
  enrolments: { table: "enrolments", roles: ["admin"] },
  compliance: { table: "staff_compliance", roles: ["admin", "safeguarding"] },
  announcements: {
    table: "announcements",
    roles: ["admin", "teacher", "parent"],
  },
  staff: { table: "users", roles: ["admin", "safeguarding"] },
} as const;
type Resource = keyof typeof resources;
const getResource = (value: string) => {
  if (!(value in resources)) throw new Error("Unknown resource");
  return value as Resource;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const resource = getResource((await params).resource);
    const who = await actor(request, [...resources[resource].roles] as Role[]);
    let data: readonly unknown[] = [];
    switch (resource) {
      case "students":
        data =
          await sql`select s.*,concat(s.first_name,' ',s.last_name) as name,g.full_name as guardian,g.phone from students s left join student_guardians sg on sg.student_id=s.id and sg.is_primary left join guardians g on g.id=sg.guardian_id order by s.last_name,s.first_name`;
        break;
      case "guardians":
        data =
          await sql`select g.*,count(sg.student_id)::int as children from guardians g left join student_guardians sg on sg.guardian_id=g.id group by g.id order by g.full_name`;
        break;
      case "applications":
        data =
          await sql`select a.*,s.student_number,concat(s.first_name,' ',s.last_name) as student_name from applications a join students s on s.id=a.student_id order by a.submitted_at desc`;
        break;
      case "classes":
        data =
          await sql`select c.*,u.display_name as teacher,count(e.id)::int as enrolled from classes c left join users u on u.id=c.teacher_id left join enrolments e on e.class_id=c.id and e.status='active' group by c.id,u.display_name order by c.day_of_week,c.start_time`;
        break;
      case "attendance":
        data =
          await sql`select a.*,concat(s.first_name,' ',s.last_name) as student_name,c.name as class_name from attendance a join students s on s.id=a.student_id join classes c on c.id=a.class_id order by a.session_date desc,s.last_name`;
        break;
      case "progress":
        data =
          who.role === "parent"
            ? await sql`select p.*,concat(s.first_name,' ',s.last_name) as student_name,c.name as class_name from progress p join students s on s.id=p.student_id join classes c on c.id=p.class_id join student_guardians sg on sg.student_id=s.id join guardians g on g.id=sg.guardian_id where g.user_id=${who.id} order by p.assessed_at desc`
            : await sql`select p.*,concat(s.first_name,' ',s.last_name) as student_name,c.name as class_name from progress p join students s on s.id=p.student_id join classes c on c.id=p.class_id order by p.assessed_at desc`;
        break;
      case "fees":
        data =
          who.role === "parent"
            ? await sql`select f.*,concat(s.first_name,' ',s.last_name) as student_name,coalesce(sum(p.amount_pence),0)::int as paid_pence from fees f join students s on s.id=f.student_id join student_guardians sg on sg.student_id=s.id join guardians g on g.id=sg.guardian_id left join payments p on p.fee_id=f.id where g.user_id=${who.id} group by f.id,s.first_name,s.last_name order by f.due_date desc`
            : await sql`select f.*,concat(s.first_name,' ',s.last_name) as student_name,coalesce(sum(p.amount_pence),0)::int as paid_pence from fees f join students s on s.id=f.student_id left join payments p on p.fee_id=f.id group by f.id,s.first_name,s.last_name order by f.due_date desc`;
        break;
      case "announcements":
        data =
          who.role === "parent"
            ? await sql`select a.*,u.display_name as author from announcements a left join users u on u.id=a.created_by where a.status='published' and a.audience in ('all','parents') order by a.created_at desc`
            : await sql`select a.*,u.display_name as author from announcements a left join users u on u.id=a.created_by order by a.created_at desc`;
        break;
      case "payments":
        data =
          await sql`select p.*,f.description,concat(s.first_name,' ',s.last_name) as student_name from payments p join fees f on f.id=p.fee_id join students s on s.id=f.student_id order by p.received_at desc`;
        break;
      case "enrolments":
        data =
          await sql`select e.*,concat(s.first_name,' ',s.last_name) as student_name,c.name as class_name from enrolments e join students s on s.id=e.student_id join classes c on c.id=e.class_id order by e.enrolled_at desc`;
        break;
      case "compliance":
        data =
          await sql`select sc.*,u.display_name as staff_name,u.email from staff_compliance sc join users u on u.id=sc.user_id order by sc.expires_at nulls last`;
        break;
      case "staff":
        data =
          await sql`select u.id,u.email,u.display_name,u.role,u.status,u.created_at,sc.check_type,sc.expires_at,sc.status as compliance_status from users u left join lateral(select check_type,expires_at,status from staff_compliance where user_id=u.id order by expires_at desc nulls last limit 1) sc on true where u.role<>'parent' order by u.display_name`;
        break;
    }
    return json({ ok: true, data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const resource = getResource((await params).resource);
    const who = await actor(request, [...resources[resource].roles] as Role[]);
    const x = await body(request);
    let row: Record<string, unknown> | undefined;
    switch (resource) {
      case "students": {
        const rows =
          await sql`insert into students(student_number,first_name,last_name,date_of_birth,gender,medical_notes,allergy_notes,additional_needs,photo_consent,emergency_consent,status) values(${required(x.studentNumber, "Student number")},${required(x.firstName, "First name")},${required(x.lastName, "Last name")},${required(x.dateOfBirth, "Date of birth")},${required(x.gender, "Gender")},${optional(x.medicalNotes)},${optional(x.allergyNotes)},${optional(x.additionalNeeds)},${boolean(x.photoConsent)},${boolean(x.emergencyConsent)},${optional(x.status) ?? "active"}) returning *`;
        row = rows[0];
        break;
      }
      case "guardians": {
        const rows =
          await sql`insert into guardians(full_name,email,phone,address,relationship) values(${required(x.fullName, "Full name")},${required(x.email, "Email")},${required(x.phone, "Phone")},${optional(x.address)},${required(x.relationship, "Relationship")}) returning *`;
        row = rows[0];
        break;
      }
      case "classes": {
        const rows =
          await sql`insert into classes(name,subject,level,teacher_id,room,day_of_week,start_time,end_time,capacity,status) values(${required(x.name, "Name")},${required(x.subject, "Subject")},${required(x.level, "Level")},${optional(x.teacherId)},${required(x.room, "Room")},${integer(x.dayOfWeek, "Day", 1)},${required(x.startTime, "Start time")},${required(x.endTime, "End time")},${integer(x.capacity, "Capacity", 1)},'active') returning *`;
        row = rows[0];
        break;
      }
      case "attendance": {
        const rows =
          await sql`insert into attendance(student_id,class_id,session_date,status,arrival_time,collection_time,collected_by_guardian_id,notes,recorded_by) values(${required(x.studentId, "Student")},${required(x.classId, "Class")},${required(x.sessionDate, "Date")},${required(x.status, "Status")},${optional(x.arrivalTime)},${optional(x.collectionTime)},${optional(x.collectedByGuardianId)},${optional(x.notes)},${who.id}) on conflict(student_id,class_id,session_date) do update set status=excluded.status,arrival_time=excluded.arrival_time,collection_time=excluded.collection_time,collected_by_guardian_id=excluded.collected_by_guardian_id,notes=excluded.notes,recorded_by=excluded.recorded_by,updated_at=now() returning *`;
        row = rows[0];
        break;
      }
      case "progress": {
        const rows =
          await sql`insert into progress(student_id,class_id,strand,current_unit,achievement,score,teacher_comment,next_step,assessed_at,recorded_by) values(${required(x.studentId, "Student")},${required(x.classId, "Class")},${required(x.strand, "Strand")},${required(x.currentUnit, "Current unit")},${required(x.achievement, "Achievement")},${x.score == null ? null : integer(x.score, "Score")},${optional(x.teacherComment)},${optional(x.nextStep)},${required(x.assessedAt, "Assessment date")},${who.id}) returning *`;
        row = rows[0];
        break;
      }
      case "fees": {
        const rows =
          await sql`insert into fees(student_id,description,amount_pence,discount_pence,due_date,status) values(${required(x.studentId, "Student")},${required(x.description, "Description")},${integer(x.amountPence, "Amount", 1)},${integer(x.discountPence ?? 0, "Discount")},${required(x.dueDate, "Due date")},'due') returning *`;
        row = rows[0];
        break;
      }
      case "announcements": {
        const rows =
          await sql`insert into announcements(title,body,audience,status,created_by,sent_at) values(${required(x.title, "Title")},${required(x.body, "Message")},${required(x.audience, "Audience")},${optional(x.status) ?? "published"},${who.id},case when ${optional(x.status) ?? "published"}='published' then now() else null end) returning *`;
        row = rows[0];
        break;
      }
      case "payments": {
        const rows =
          await sql`insert into payments(fee_id,amount_pence,method,reference,received_at,recorded_by) values(${required(x.feeId, "Fee")},${integer(x.amountPence, "Amount", 1)},${required(x.method, "Method")},${optional(x.reference)},now(),${who.id}) returning *`;
        row = rows[0];
        await sql`update fees f set status=case when coalesce((select sum(amount_pence) from payments where fee_id=f.id),0)>=f.amount_pence-f.discount_pence then 'paid' else 'part-paid' end,updated_at=now() where id=${required(x.feeId, "Fee")}`;
        break;
      }
      case "enrolments": {
        const rows =
          await sql`insert into enrolments(student_id,class_id,status) values(${required(x.studentId, "Student")},${required(x.classId, "Class")},'active') on conflict(student_id,class_id) do update set status='active',updated_at=now() returning *`;
        row = rows[0];
        await sql`update students set status='active',updated_at=now() where id=${required(x.studentId, "Student")}`;
        break;
      }
      case "compliance": {
        const rows =
          await sql`insert into staff_compliance(user_id,check_type,status,completed_at,expires_at,notes) values(${required(x.userId, "Staff member")},${required(x.checkType, "Check type")},${required(x.status, "Status")},${optional(x.completedAt)},${optional(x.expiresAt)},${optional(x.notes)}) returning *`;
        row = rows[0];
        break;
      }
      case "staff": {
        if (who.role !== "admin")
          throw new Error("Only administrators can create staff accounts");
        const rows =
          await sql`insert into users(email,display_name,password_hash,role,status) values(${required(x.email, "Email")},${required(x.displayName, "Display name")},${await hash(required(x.password, "Temporary password"), 12)},${required(x.role, "Role")},'active') returning id,email,display_name,role,status`;
        row = rows[0];
        break;
      }
      default:
        throw new Error("Creation is not available for this resource");
    }
    await audit(who, "create", resource, String(row?.id));
    return json({ ok: true, data: row }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const resource = getResource((await params).resource);
    const who = await actor(request, ["admin"]);
    const x = await body(request);
    const id = required(x.id, "ID"),
      status = required(x.status, "Status");
    const table = sql(resources[resource].table);
    const rows =
      await sql`update ${table} set status=${status},updated_at=now() where id=${id} returning *`;
    if (!rows[0]) return json({ ok: false, error: "Record not found" }, 404);
    await audit(who, "update-status", resource, id, { status });
    return json({ ok: true, data: rows[0] });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const resource = getResource((await params).resource);
    const who = await actor(request, ["admin"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ ok: false, error: "ID is required" }, 400);
    const table = sql(resources[resource].table);
    const rows = await sql`delete from ${table} where id=${id} returning id`;
    if (!rows[0]) return json({ ok: false, error: "Record not found" }, 404);
    await audit(who, "delete", resource, id);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
