import { hash } from "bcryptjs";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { sql } = await import("./index");

const passwordHash = await hash("Madrasat2026!", 12);
await sql.begin(async (tx) => {
  await tx`insert into users(email,display_name,password_hash,role) values
    ('admin@boltonmadrasat.local','Amina Yusuf',${passwordHash},'admin'),
    ('teacher@boltonmadrasat.local','Ustadh Musa Bello',${passwordHash},'teacher'),
    ('finance@boltonmadrasat.local','Maryam Sani',${passwordHash},'finance'),
    ('safeguarding@boltonmadrasat.local','Khadijah Lawal',${passwordHash},'safeguarding'),
    ('parent@boltonmadrasat.local','Ibrahim Adamu',${passwordHash},'parent')
    on conflict(email) do update set display_name=excluded.display_name,password_hash=excluded.password_hash,role=excluded.role,status='active'`;
  const teacher = await tx<
    { id: string }[]
  >`select id from users where email='teacher@boltonmadrasat.local'`;
  const parent = await tx<
    { id: string }[]
  >`select id from users where email='parent@boltonmadrasat.local'`;
  const admin = await tx<
    { id: string }[]
  >`select id from users where email='admin@boltonmadrasat.local'`;
  const guardian = await tx<
    { id: string }[]
  >`insert into guardians(user_id,full_name,email,phone,address,relationship) values(${parent[0].id},'Ibrahim Adamu','parent@boltonmadrasat.local','07700 900321','Bolton, Greater Manchester','Father') on conflict do nothing returning id`;
  const guardianId =
    guardian[0]?.id ??
    (
      await tx<
        { id: string }[]
      >`select id from guardians where email='parent@boltonmadrasat.local' limit 1`
    )[0].id;
  await tx`insert into students(student_number,first_name,last_name,date_of_birth,gender,status,photo_consent,emergency_consent) values
    ('BMS-2026-001','Maryam','Adamu','2015-04-12','Female','active',true,true),
    ('BMS-2026-002','Yusuf','Adamu','2017-09-21','Male','active',true,true),
    ('BMS-2026-003','Fatimah','Bello','2016-01-08','Female','active',false,true)
    on conflict(student_number) do nothing`;
  await tx`insert into student_guardians(student_id,guardian_id,is_primary,authorised_collection) select id,${guardianId},true,true from students where student_number in ('BMS-2026-001','BMS-2026-002') on conflict(student_id,guardian_id) do nothing`;
  await tx`insert into classes(name,subject,level,teacher_id,room,day_of_week,start_time,end_time,capacity,status) select 'Qa''idah Foundation','Qur''an & Tajwid','Foundation',${teacher[0].id},'Room 1',6,'10:00','11:00',18,'active' where not exists(select 1 from classes where name='Qa''idah Foundation')`;
  const classRow = await tx<
    { id: string }[]
  >`select id from classes where name='Qa''idah Foundation' limit 1`;
  await tx`insert into enrolments(student_id,class_id) select id,${classRow[0].id} from students where student_number in ('BMS-2026-001','BMS-2026-002','BMS-2026-003') on conflict(student_id,class_id) do nothing`;
  await tx`insert into fees(student_id,description,amount_pence,discount_pence,due_date,status) select id,'Autumn term tuition',7500,0,current_date+30,'due' from students where student_number in ('BMS-2026-001','BMS-2026-002','BMS-2026-003') and not exists(select 1 from fees f where f.student_id=students.id and f.description='Autumn term tuition')`;
  await tx`insert into announcements(title,body,audience,status,sent_at,created_by) select 'Welcome to the new term','Assalamu alaikum. Classes begin this Saturday at 10:00.','all','published',now(),${admin[0].id} where not exists(select 1 from announcements where title='Welcome to the new term')`;
  await tx`insert into staff_compliance(user_id,check_type,status,completed_at,expires_at) select ${teacher[0].id},'Enhanced DBS','valid',current_date-120,current_date+245 where not exists(select 1 from staff_compliance where user_id=${teacher[0].id} and check_type='Enhanced DBS')`;
});
console.log("Seed complete. Password for all demo accounts: Madrasat2026!");
await sql.end();
