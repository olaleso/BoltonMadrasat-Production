import { d1 } from "@/db";

import {
  actor,
  body,
  fail,
  json,
  optional,
  required,
  boolean,
  ApiError,
} from "@/lib/backend";
import { provisionParentAccess } from "@/lib/parent-access";

type ClassRow = {
  id: string;
  name: string;
  capacity: number;
  enrolled: number;
};

type FeePlanRow = {
  id: string;
  name: string;
  amount_pence: number;
};

type GuardianRow = {
  id: string;
  full_name: string;
  email: string;
};

async function first<T>(query: string, ...bindings: unknown[]) {
  const statement = d1().prepare(query);
  return bindings.length
    ? statement.bind(...bindings).first<T>()
    : statement.first<T>();
}

function dateValue(value: unknown, label: string) {
  const result = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new ApiError(400, `${label} must be in YYYY-MM-DD format`);
  }
  return result;
}

function genderValue(value: unknown) {
  const result = required(value, "Gender").toLowerCase();
  if (result === "male") return "Male";
  if (result === "female") return "Female";
  throw new ApiError(400, "Gender must be Male or Female");
}

function emailValue(value: unknown) {
  const result = required(value, "Guardian email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(result)) {
    throw new ApiError(400, "Enter a valid guardian email address");
  }
  return result;
}

function ethnicGroupValue(value: unknown, other: unknown) {
  const group = required(value, "Ethnic group");
  const allowed = [
    "Hausa",
    "Yoruba",
    "Igbo",
    "Edo",
    "Kogi",
    "Other",
    "Prefer not to say",
  ];

  if (!allowed.includes(group)) {
    throw new ApiError(400, "Select a valid ethnic group");
  }

  if (group === "Other") {
    return required(other, "Other ethnicity");
  }

  return group;
}

async function uniqueStudentNumber() {
  const year = new Date().getUTCFullYear();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = String(
      crypto.getRandomValues(new Uint32Array(1))[0] % 100000,
    ).padStart(5, "0");
    const candidate = `BNMC-${year}-${suffix}`;
    const existing = await first<{ id: string }>(
      "select id from students where student_number = ? limit 1",
      candidate,
    );
    if (!existing) return candidate;
  }

  throw new ApiError(503, "Unable to generate a student number. Please try again.");
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const x = await body(request);

    const firstName = required(x.firstName, "Student first name");
    const lastName = required(x.lastName, "Student last name");
    const dateOfBirth = dateValue(x.dateOfBirth, "Date of birth");
    const gender = genderValue(x.gender);
    const ethnicGroup = ethnicGroupValue(x.ethnicGroup, x.otherEthnicity);
    const startsOn = dateValue(x.startsOn, "Start date");
    const classId = required(x.classId, "Class");
    const guardianMode = required(x.guardianMode, "Guardian option");

    if (!["existing", "new"].includes(guardianMode)) {
      throw new ApiError(400, "Select an existing guardian or add a new guardian");
    }

    const classRow = await first<ClassRow>(
      `select
         c.id,
         c.name,
         c.capacity,
         (
           select count(*)
           from enrolments e
           where e.class_id = c.id and e.status = 'active'
         ) as enrolled
       from classes c
       where c.id = ? and c.status = 'active'
       limit 1`,
      classId,
    );

    if (!classRow) throw new ApiError(404, "The selected class is not available");

    if (!classRow.name.toLowerCase().includes(`(${gender.toLowerCase()})`)) {
      throw new ApiError(409, `Please select a ${gender} class for this student.`);
    }

    if (Number(classRow.enrolled) >= Number(classRow.capacity)) {
      throw new ApiError(409, `${classRow.name} is already full.`);
    }

    const feePlan = await first<FeePlanRow>(
      `select id, name, amount_pence
       from fee_plans
       where active = 1
         and frequency = 'monthly'
         and amount_pence = 3000
       order by case when id = 'standard-monthly-30' then 0 else 1 end, created_at
       limit 1`,
    );

    if (!feePlan) {
      throw new ApiError(409, "The standard £30 monthly fee has not been configured.");
    }

    const duplicateStudent = await first<{ id: string; student_number: string }>(
      `select id, student_number
       from students
       where lower(first_name) = lower(?)
         and lower(last_name) = lower(?)
         and date_of_birth = ?
       limit 1`,
      firstName,
      lastName,
      dateOfBirth,
    );

    if (duplicateStudent) {
      throw new ApiError(
        409,
        `A matching student already exists (${duplicateStudent.student_number}). Open that profile instead.`,
      );
    }

    let guardian: GuardianRow | null = null;
    let createGuardian = false;

    if (guardianMode === "existing") {
      const guardianId = required(x.guardianId, "Existing guardian");
      guardian = await first<GuardianRow>(
        `select id, full_name, email from guardians where id = ? limit 1`,
        guardianId,
      );
      if (!guardian) throw new ApiError(404, "The selected guardian was not found");
    } else {
      const guardianEmail = emailValue(x.guardianEmail);
      const duplicate = await first<{ id: string }>(
        "select id from guardians where lower(email) = lower(?) limit 1",
        guardianEmail,
      );
      if (duplicate) {
        throw new ApiError(
          409,
          "A guardian with this email already exists. Select Existing guardian instead.",
        );
      }

      guardian = {
        id: crypto.randomUUID(),
        full_name: required(x.guardianName, "Guardian full name"),
        email: guardianEmail,
      };
      createGuardian = true;
    }

    const guardianAccount = await first<{ role: string }>(
      "select lower(role) as role from users where lower(email) = lower(?) limit 1",
      guardian.email,
    );

    if (guardianAccount && guardianAccount.role !== "parent") {
      throw new ApiError(
        409,
        "This guardian email belongs to a staff account. Use a separate parent email address.",
      );
    }

    const studentId = crypto.randomUUID();
    const applicationId = crypto.randomUUID();
    const guardianLinkId = crypto.randomUUID();
    const enrolmentId = crypto.randomUUID();
    const agreementId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const studentNumber = await uniqueStudentNumber();
    const billingYear = Number(startsOn.slice(0, 4));
    const billingMonth = Number(startsOn.slice(5, 7));
    const invoiceDescription = `${feePlan.name} - ${new Intl.DateTimeFormat(
      "en-GB",
      { month: "long", year: "numeric", timeZone: "UTC" },
    ).format(new Date(`${startsOn}T00:00:00Z`))}`;

    const db = d1();
    const statements: D1PreparedStatement[] = [];

    if (createGuardian) {
      statements.push(
        db.prepare(
          `insert into guardians
             (id, full_name, email, phone, address, postcode,
              emergency_contact_number, relationship)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          guardian.id,
          guardian.full_name,
          guardian.email,
          required(x.guardianPhone, "Guardian phone"),
          required(x.guardianAddress, "Guardian address"),
          required(x.guardianPostcode, "Guardian postcode"),
          required(x.emergencyContactNumber, "Emergency contact number"),
          required(x.relationship, "Relationship"),
        ),
      );
    }

    statements.push(
      db.prepare(
        `insert into students
           (id, student_number, first_name, last_name, date_of_birth, gender,
            ethnic_group, medical_notes, allergy_notes, additional_needs,
            photo_consent, emergency_consent, status)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      ).bind(
        studentId,
        studentNumber,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        ethnicGroup,
        optional(x.medicalNotes),
        optional(x.allergyNotes),
        optional(x.additionalNeeds),
        boolean(x.photoConsent) ? 1 : 0,
        boolean(x.emergencyConsent) ? 1 : 0,
      ),
      db.prepare(
        `insert into student_guardians
           (id, student_id, guardian_id, is_primary, authorised_collection)
         values (?, ?, ?, 1, 1)`,
      ).bind(guardianLinkId, studentId, guardian.id),
      db.prepare(
        `insert into applications
           (id, student_id, preferred_session, prior_level, status,
            application_fee_pence, payment_status, submitted_at,
            reviewed_by, review_notes)
         values (?, ?, ?, ?, 'accepted', 0, 'waived', CURRENT_TIMESTAMP, ?, ?)`,
      ).bind(
        applicationId,
        studentId,
        optional(x.preferredSession) ?? "Saturday 09:30-11:30",
        optional(x.priorLevel),
        who.id,
        optional(x.reviewNotes) ?? "Registered manually by administrator",
      ),
      db.prepare(
        `insert into enrolments
           (id, student_id, class_id, enrolled_at, status)
         values (?, ?, ?, ?, 'active')`,
      ).bind(enrolmentId, studentId, classId, startsOn),
      db.prepare(
        `insert into student_fee_agreements
           (id, student_id, fee_plan_id, monthly_amount_pence, discount_pence,
            billing_day, starts_on, ends_on, collection_method, status)
         values (?, ?, ?, 3000, 0, 1, ?, null, 'online', 'active')`,
      ).bind(agreementId, studentId, feePlan.id, startsOn),
      db.prepare(
        `insert into fee_invoices
           (id, student_id, agreement_id, billing_year, billing_month,
            description, amount_pence, discount_pence, amount_due_pence,
            amount_paid_pence, due_date, status)
         values (?, ?, ?, ?, ?, ?, 3000, 0, 3000, 0, ?, 'pending')`,
      ).bind(
        invoiceId,
        studentId,
        agreementId,
        billingYear,
        billingMonth,
        invoiceDescription,
        startsOn,
      ),
      db.prepare(
        `insert into audit_log
           (id, user_id, action, entity_type, entity_id, details)
         values (?, ?, 'manual-student-registration', 'students', ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        who.id,
        studentId,
        JSON.stringify({
          applicationId,
          guardianId: guardian.id,
          classId,
          className: classRow.name,
          startsOn,
          monthlyFeePence: 3000,
        }),
      ),
    );

    await db.batch(statements);

    const parentAccess = await provisionParentAccess(
      applicationId,
      new URL(request.url).origin,
    );

    return json({
      ok: true,
      studentId,
      applicationId,
      studentNumber,
      studentName: `${firstName} ${lastName}`,
      className: classRow.name,
      parentAccess,
    });
  } catch (error) {
    return fail(error);
  }
}
