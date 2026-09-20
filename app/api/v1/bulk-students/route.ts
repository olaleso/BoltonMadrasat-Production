import { d1 } from "@/db";
import {
  actor,
  body,
  fail,
  json,
  ApiError,
} from "@/lib/backend";
import { provisionGuardianPortalAccess } from "@/lib/parent-access";

type ImportMode =
  | "standard_students"
  | "legacy_students"
  | "guardian_updates";

type Row = Record<string, unknown>;

type ClassRow = {
  id: string;
  name: string;
  capacity: number;
  enrolled: number;
  status: string;
};

type StudentRow = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
};

type PreviewStatus = "valid" | "warning" | "error";

type PreviewRow = {
  rowNumber: number;
  status: PreviewStatus;
  action: "create" | "link" | "update" | "skip";
  studentNumber: string;
  studentName: string;
  className: string;
  messages: string[];
  normalized: Row;
};

async function all<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T[]> {
  const statement = d1().prepare(query);
  const result = bindings.length
    ? await statement.bind(...bindings).all<T>()
    : await statement.all<T>();
  return result.results;
}

async function first<T = Row>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);
  return bindings.length
    ? await statement.bind(...bindings).first<T>()
    : await statement.first<T>();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function rowValue(
  row: Row,
  ...names: string[]
) {
  const wanted = new Set(
    names.map(normalizedKey),
  );

  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(normalizedKey(key))) {
      return value;
    }
  }

  return "";
}

function normalizeGender(value: unknown) {
  const raw = text(value).toLowerCase();
  if (["male", "boy", "m"].includes(raw)) return "Male";
  if (["female", "girl", "f"].includes(raw)) return "Female";
  return "";
}

function normalizeCategory(value: unknown) {
  const raw = text(value).toLowerCase();
  const match = raw.match(/[123]/);
  return match?.[0] ?? "";
}

function splitName(
  firstValue: unknown,
  lastValue: unknown,
  fullValue: unknown,
) {
  let firstName = text(firstValue);
  let lastName = text(lastValue);
  const fullName = text(fullValue);

  if ((!firstName || !lastName) && fullName) {
    const parts = fullName
      .split(/\s+/)
      .filter(Boolean);

    if (!firstName) {
      firstName = parts.shift() ?? "";
    }

    if (!lastName) {
      lastName = parts.join(" ");
    }
  }

  return {
    firstName,
    lastName,
  };
}

function excelSerialToDate(value: number) {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(
    epoch + Math.round(value) * 86400000,
  );
  return date.toISOString().slice(0, 10);
}

function dateResult(
  dateValue: unknown,
  yearValue: unknown,
  ageValue: unknown,
) {
  const raw = text(dateValue);

  if (typeof dateValue === "number" && dateValue > 10000) {
    return {
      value: excelSerialToDate(dateValue),
      warning: "",
      error: "",
    };
  }

  if (raw) {
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      const y = Number(iso[1]);
      const m = Number(iso[2]);
      const d = Number(iso[3]);
      if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          value: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          warning: "",
          error: "",
        };
      }
    }

    const uk = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (uk) {
      const d = Number(uk[1]);
      const m = Number(uk[2]);
      const y = Number(uk[3]);
      if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          value: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          warning: "",
          error: "",
        };
      }
    }

    if (/^\d{4}$/.test(raw)) {
      const year = Number(raw);
      if (year >= 2000 && year <= new Date().getUTCFullYear()) {
        return {
          value: `${year}-01-01`,
          warning: "Only the year of birth was supplied, so 1 January has been used as an approximate date of birth.",
          error: "",
        };
      }
    }

    return {
      value: "",
      warning: "",
      error: "Date of birth must be YYYY-MM-DD or DD/MM/YYYY.",
    };
  }

  const yearRaw = text(yearValue);
  if (/^\d{4}$/.test(yearRaw)) {
    const year = Number(yearRaw);
    if (year >= 2000 && year <= new Date().getUTCFullYear()) {
      return {
        value: `${year}-01-01`,
        warning: "Only the year of birth was supplied, so 1 January has been used as an approximate date of birth.",
        error: "",
      };
    }
  }

  const age = Number(text(ageValue));
  if (Number.isInteger(age) && age >= 3 && age <= 25) {
    const year = new Date().getUTCFullYear() - age;
    return {
      value: `${year}-01-01`,
      warning: `Only age ${age} was supplied, so ${year}-01-01 has been used as an approximate date of birth. Please correct it later if the exact DOB becomes available.`,
      error: "",
    };
  }

  return {
    value: "",
    warning: "",
    error: "Date of birth, year of birth or age is required.",
  };
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSampleRow(row: Row) {
  const email = text(
    rowValue(
      row,
      "Parent / guardian email",
      "guardianEmail",
    ),
  ).toLowerCase();

  const { firstName, lastName } = splitName(
    rowValue(row, "First name", "firstName"),
    rowValue(row, "Last name", "lastName"),
    rowValue(row, "Full student name", "fullName"),
  );

  return (
    email === "parent@example.com" ||
    (firstName.toLowerCase() === "sample" &&
      lastName.toLowerCase() === "student")
  );
}

function statusFromMessages(
  errors: string[],
  warnings: string[],
): PreviewStatus {
  if (errors.length) return "error";
  if (warnings.length) return "warning";
  return "valid";
}

function classFor(
  classes: ClassRow[],
  classValue: unknown,
  categoryValue: unknown,
  gender: string,
) {
  const supplied = text(classValue);
  const category = normalizeCategory(categoryValue);
  const desired = supplied ||
    (category && gender
      ? `Category ${category} (${gender})`
      : "");

  if (!desired) {
    return {
      classRow: null as ClassRow | null,
      desired: "",
      error: "Class is required, or provide Category + Gender so the class can be derived.",
    };
  }

  const match = classes.find(
    (item) =>
      item.name.toLowerCase() === desired.toLowerCase(),
  ) ?? null;

  if (!match) {
    return {
      classRow: null as ClassRow | null,
      desired,
      error: `${desired} is not an active BNMC class.`,
    };
  }

  if (
    gender &&
    !match.name.toLowerCase().includes(`(${gender.toLowerCase()})`)
  ) {
    return {
      classRow: match,
      desired,
      error: `${match.name} does not match the student's gender (${gender}).`,
    };
  }

  return {
    classRow: match,
    desired: match.name,
    error: "",
  };
}

async function loadClasses() {
  return await all<ClassRow>(
    `select
       c.id,
       c.name,
       c.capacity,
       c.status,
       count(e.id) as enrolled
     from classes c
     left join enrolments e
       on e.class_id = c.id
      and e.status = 'active'
     where c.status = 'active'
     group by c.id
     order by c.name`,
  );
}

async function studentPreview(
  mode: "standard_students" | "legacy_students",
  rawRows: Row[],
): Promise<PreviewRow[]> {
  const classes = await loadClasses();
  const students = await all<StudentRow>(
    `select
       id,
       student_number,
       first_name,
       last_name,
       date_of_birth
     from students`,
  );

  const existingNumbers = new Set(
    students.map((item) =>
      item.student_number.toLowerCase(),
    ),
  );

  const existingSignatures = new Set(
    students.map((item) =>
      `${item.first_name.toLowerCase()}|${item.last_name.toLowerCase()}|${item.date_of_birth}`,
    ),
  );

  const seenNumbers = new Set<string>();
  const simulatedCounts = new Map(
    classes.map((item) => [
      item.id,
      Number(item.enrolled ?? 0),
    ]),
  );

  let legacySequence = 1;
  const currentYear = new Date().getUTCFullYear();

  function nextLegacyNumber() {
    while (true) {
      const candidate = `BNMC-${currentYear}-${String(legacySequence).padStart(4, "0")}`;
      legacySequence += 1;
      if (!existingNumbers.has(candidate.toLowerCase()) && !seenNumbers.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  const result: PreviewRow[] = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    const row = rawRows[index] ?? {};
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isSampleRow(row)) {
      result.push({
        rowNumber,
        status: "warning",
        action: "skip",
        studentNumber: text(rowValue(row, "Student number", "studentNumber")),
        studentName: "Sample Student",
        className: text(rowValue(row, "Class")),
        messages: ["Sample/template row detected. It will not be imported."],
        normalized: {},
      });
      continue;
    }

    const names = splitName(
      rowValue(row, "First name", "firstName"),
      rowValue(row, "Last name", "lastName"),
      rowValue(row, "Full student name", "fullName"),
    );

    if (!names.firstName) errors.push("First name is required.");
    if (!names.lastName) {
      if (mode === "legacy_students") {
        warnings.push("Last name is missing. Admin should complete it later from the student profile.");
      } else {
        errors.push("Last name is required.");
      }
    }

    const gender = normalizeGender(
      rowValue(row, "Gender"),
    );
    if (!gender) {
      errors.push("Gender must be Male or Female.");
    }

    const dobValue = rowValue(row, "Date of birth", "dateOfBirth");
    const yearValue = rowValue(row, "Year of birth", "yearOfBirth");
    const ageValue = rowValue(row, "Age");

    const dob = dateResult(
      dobValue,
      yearValue,
      ageValue,
    );

    const hasBirthInformation = Boolean(
      text(dobValue) ||
      text(yearValue) ||
      text(ageValue),
    );

    if (dob.error) {
      if (mode === "legacy_students" && !hasBirthInformation) {
        warnings.push("Date of birth is missing. Admin should complete it later from the student profile.");
      } else {
        errors.push(dob.error);
      }
    }
    if (dob.warning) warnings.push(dob.warning);

    let studentNumber = text(
      rowValue(row, "Student number", "studentNumber"),
    );

    if (!studentNumber) {
      studentNumber = nextLegacyNumber();
      warnings.push(`No student number was supplied. ${studentNumber} will be used as a provisional registration number.`);
    }

    const numberKey = studentNumber.toLowerCase();
    if (seenNumbers.has(numberKey)) {
      errors.push(`Student number ${studentNumber} appears more than once in this workbook.`);
    }
    seenNumbers.add(numberKey);

    let action: PreviewRow["action"] = "create";

    if (existingNumbers.has(numberKey)) {
      action = "skip";
      warnings.push(`Student number ${studentNumber} already exists. This row will be skipped.`);
    }

    const signature = `${names.firstName.toLowerCase()}|${names.lastName.toLowerCase()}|${dob.value}`;
    if (
      action === "create" &&
      names.firstName &&
      names.lastName &&
      dob.value &&
      existingSignatures.has(signature)
    ) {
      action = "skip";
      warnings.push("A student with the same name and date of birth already exists. This row will be skipped to avoid a duplicate.");
    }

    const classResult = classFor(
      classes,
      rowValue(row, "Class", "className"),
      rowValue(row, "Category"),
      gender,
    );
    if (classResult.error) errors.push(classResult.error);

    if (
      action === "create" &&
      classResult.classRow &&
      errors.length === 0
    ) {
      const current = simulatedCounts.get(classResult.classRow.id) ?? 0;
      if (current >= Number(classResult.classRow.capacity)) {
        errors.push(`${classResult.classRow.name} is full (${current}/${classResult.classRow.capacity}).`);
      } else {
        simulatedCounts.set(classResult.classRow.id, current + 1);
      }
    }

    const guardianName = text(
      rowValue(row, "Parent / guardian name", "guardianName"),
    );
    const guardianEmail = text(
      rowValue(row, "Parent / guardian email", "guardianEmail"),
    ).toLowerCase();
    const guardianPhone = text(
      rowValue(row, "Parent / guardian phone", "guardianPhone"),
    );

    if (mode === "standard_students") {
      if (!guardianName) errors.push("Parent / guardian name is required for a standard import.");
      if (!guardianEmail) errors.push("Parent / guardian email is required for a standard import.");
      if (guardianEmail && !validEmail(guardianEmail)) errors.push("Parent / guardian email is not valid.");
      if (!guardianPhone) errors.push("Parent / guardian phone is required for a standard import.");
    } else {
      warnings.push("Guardian details are intentionally left pending and can be added later with the Guardian Update import.");
    }

    const normalized: Row = {
      studentNumber,
      firstName: names.firstName,
      lastName: names.lastName,
      dateOfBirth: dob.value,
      gender,
      classId: classResult.classRow?.id ?? "",
      className: classResult.classRow?.name ?? classResult.desired,
      enrolledAt: text(rowValue(row, "Admission / start date", "Admission date", "Start date")),
      medicalNotes: text(rowValue(row, "Medical notes", "medicalNotes")),
      allergyNotes: text(rowValue(row, "Allergies", "allergyNotes")),
      additionalNeeds: text(rowValue(row, "Additional needs", "additionalNeeds")),
      guardianName,
      guardianEmail,
      guardianPhone,
      guardianAddress: text(rowValue(row, "Address", "guardianAddress")),
      guardianPostcode: text(rowValue(row, "Postcode", "guardianPostcode")),
      guardianRelationship: text(rowValue(row, "Relationship")) || "Guardian",
      emergencyContactNumber: text(rowValue(row, "Emergency contact number", "emergencyContactNumber")),
    };

    result.push({
      rowNumber,
      status: statusFromMessages(errors, warnings),
      action,
      studentNumber,
      studentName: `${names.firstName} ${names.lastName}`.trim(),
      className: String(normalized.className ?? ""),
      messages: [...errors, ...warnings],
      normalized,
    });
  }

  return result;
}

async function guardianPreview(
  rawRows: Row[],
): Promise<PreviewRow[]> {
  const students = await all<{
    id: string;
    student_number: string;
    first_name: string;
    last_name: string;
  }>(
    `select id, student_number, first_name, last_name from students`,
  );

  const byNumber = new Map(
    students.map((item) => [
      item.student_number.toLowerCase(),
      item,
    ]),
  );

  const primary = await all<{
    student_id: string;
    guardian_id: string;
    email: string;
  }>(
    `select
       sg.student_id,
       sg.guardian_id,
       g.email
     from student_guardians sg
     join guardians g on g.id = sg.guardian_id
     where sg.is_primary = 1`,
  );

  const primaryByStudent = new Map(
    primary.map((item) => [
      item.student_id,
      item,
    ]),
  );

  const seen = new Set<string>();
  const result: PreviewRow[] = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    const row = rawRows[index] ?? {};
    const rowNumber = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isSampleRow(row)) {
      result.push({
        rowNumber,
        status: "warning",
        action: "skip",
        studentNumber: text(rowValue(row, "Student number")),
        studentName: "Sample Student",
        className: "",
        messages: ["Sample/template row detected. It will not be applied."],
        normalized: {},
      });
      continue;
    }

    const studentNumber = text(
      rowValue(row, "Student number", "studentNumber"),
    );
    if (!studentNumber) errors.push("Student number is required.");

    const student = byNumber.get(studentNumber.toLowerCase());
    if (studentNumber && !student) {
      errors.push(`No student was found with registration number ${studentNumber}.`);
    }

    if (studentNumber && seen.has(studentNumber.toLowerCase())) {
      errors.push(`Student number ${studentNumber} appears more than once in this workbook.`);
    }
    seen.add(studentNumber.toLowerCase());

    const guardianName = text(
      rowValue(row, "Parent / guardian name", "guardianName"),
    );
    const guardianEmail = text(
      rowValue(row, "Parent / guardian email", "guardianEmail"),
    ).toLowerCase();
    const guardianPhone = text(
      rowValue(row, "Parent / guardian phone", "guardianPhone"),
    );

    if (!guardianName) errors.push("Parent / guardian name is required.");
    if (!guardianEmail) errors.push("Parent / guardian email is required.");
    if (guardianEmail && !validEmail(guardianEmail)) errors.push("Parent / guardian email is not valid.");
    if (!guardianPhone) errors.push("Parent / guardian phone is required.");

    let action: PreviewRow["action"] = "link";
    if (student) {
      const current = primaryByStudent.get(student.id);
      if (current) {
        if (current.email.toLowerCase() === guardianEmail) {
          action = "update";
          warnings.push("This guardian is already linked as the primary guardian. Contact details will be updated where supplied.");
        } else {
          action = "skip";
          warnings.push("This student already has a different primary guardian. The row will be skipped rather than replacing an existing relationship automatically.");
        }
      }
    }

    const normalized: Row = {
      studentId: student?.id ?? "",
      studentNumber,
      guardianName,
      guardianEmail,
      guardianPhone,
      relationship: text(rowValue(row, "Relationship")) || "Guardian",
      address: text(rowValue(row, "Address")),
      postcode: text(rowValue(row, "Postcode")),
      emergencyContactNumber: text(rowValue(row, "Emergency contact number", "emergencyContactNumber")),
    };

    result.push({
      rowNumber,
      status: statusFromMessages(errors, warnings),
      action,
      studentNumber,
      studentName: student
        ? `${student.first_name} ${student.last_name}`
        : "",
      className: "",
      messages: [...errors, ...warnings],
      normalized,
    });
  }

  return result;
}

function previewSummary(rows: PreviewRow[]) {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === "valid").length,
    warning: rows.filter((row) => row.status === "warning").length,
    error: rows.filter((row) => row.status === "error").length,
    create: rows.filter((row) => row.action === "create" && row.status !== "error").length,
    link: rows.filter((row) => ["link", "update"].includes(row.action) && row.status !== "error").length,
    skip: rows.filter((row) => row.action === "skip").length,
  };
}

async function commitStudents(
  who: { id: string },
  mode: "standard_students" | "legacy_students",
  rows: PreviewRow[],
) {
  const db = d1();
  let created = 0;
  let skipped = 0;
  const errors: { rowNumber: number; error: string }[] = [];

  for (const item of rows) {
    if (item.status === "error" || item.action === "skip") {
      skipped += 1;
      continue;
    }

    const x = item.normalized;
    const studentId = crypto.randomUUID();
    const statements = [];

    try {
      statements.push(
        db.prepare(
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
               status
             )
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        ).bind(
          studentId,
          text(x.studentNumber),
          text(x.firstName),
          text(x.lastName),
          text(x.dateOfBirth),
          text(x.gender),
          text(x.medicalNotes) || null,
          text(x.allergyNotes) || null,
          text(x.additionalNeeds) || null,
        ),
      );

      const classId = text(x.classId);
      if (classId) {
        statements.push(
          db.prepare(
            `insert into enrolments
               (id, student_id, class_id, enrolled_at, status)
             values (?, ?, ?, coalesce(?, CURRENT_TIMESTAMP), 'active')`,
          ).bind(
            crypto.randomUUID(),
            studentId,
            classId,
            text(x.enrolledAt) || null,
          ),
        );
      }

      if (mode === "standard_students") {
        const guardianEmail = text(x.guardianEmail).toLowerCase();
        let guardian = await first<{ id: string }>(
          `select id from guardians where lower(email) = lower(?) limit 1`,
          guardianEmail,
        );

        const guardianId = guardian?.id ?? crypto.randomUUID();

        if (!guardian) {
          statements.push(
            db.prepare(
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
               values (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
              guardianId,
              text(x.guardianName),
              guardianEmail,
              text(x.guardianPhone),
              text(x.guardianAddress) || null,
              text(x.guardianPostcode) || null,
              text(x.emergencyContactNumber) || null,
              text(x.guardianRelationship) || "Guardian",
            ),
          );
        }

        statements.push(
          db.prepare(
            `insert into student_guardians
               (id, student_id, guardian_id, is_primary, authorised_collection)
             values (?, ?, ?, 1, 1)`,
          ).bind(
            crypto.randomUUID(),
            studentId,
            guardianId,
          ),
        );
      }

      statements.push(
        db.prepare(
          `insert into audit_log
             (id, user_id, action, entity_type, entity_id, details)
           values (?, ?, ?, 'students', ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          who.id,
          mode === "legacy_students"
            ? "legacy-student-import"
            : "bulk-student-import",
          studentId,
          JSON.stringify({
            studentNumber: text(x.studentNumber),
            className: text(x.className),
            guardianPending: mode === "legacy_students",
          }),
        ),
      );

      await db.batch(statements);
      created += 1;
    } catch (error) {
      errors.push({
        rowNumber: item.rowNumber,
        error: error instanceof Error
          ? error.message
          : "Unable to import this row.",
      });
    }
  }

  return {
    created,
    skipped,
    failed: errors.length,
    errors,
  };
}

async function commitGuardians(
  who: { id: string },
  rows: PreviewRow[],
  requestOrigin: string,
) {
  const db = d1();
  let linked = 0;
  let updated = 0;
  let skipped = 0;
  let portalSetupSent = 0;
  let portalAccessAdded = 0;
  let portalExisting = 0;
  let portalFailed = 0;

  const portalMessages: {
    email: string;
    status: string;
    message: string;
  }[] = [];

  /*
   * Several students may share the same parent/guardian email.
   * Provision the account only once per unique email during this import,
   * while still linking every child to the guardian.
   */
  const provisionedEmails = new Set<string>();

  const errors: { rowNumber: number; error: string }[] = [];

  for (const item of rows) {
    if (item.status === "error" || item.action === "skip") {
      skipped += 1;
      continue;
    }

    const x = item.normalized;
    const studentId = text(x.studentId);
    const guardianEmail = text(x.guardianEmail).toLowerCase();

    try {
      let guardian = await first<{ id: string }>(
        `select id from guardians where lower(email) = lower(?) limit 1`,
        guardianEmail,
      );

      const guardianId = guardian?.id ?? crypto.randomUUID();
      const statements = [];

      if (guardian) {
        statements.push(
          db.prepare(
            `update guardians
             set
               full_name = ?,
               phone = ?,
               relationship = ?,
               address = coalesce(nullif(?, ''), address),
               postcode = coalesce(nullif(?, ''), postcode),
               emergency_contact_number = coalesce(nullif(?, ''), emergency_contact_number),
               updated_at = CURRENT_TIMESTAMP
             where id = ?`,
          ).bind(
            text(x.guardianName),
            text(x.guardianPhone),
            text(x.relationship) || "Guardian",
            text(x.address),
            text(x.postcode),
            text(x.emergencyContactNumber),
            guardianId,
          ),
        );
      } else {
        statements.push(
          db.prepare(
            `insert into guardians
               (
                 id,
                 full_name,
                 email,
                 phone,
                 relationship,
                 address,
                 postcode,
                 emergency_contact_number
               )
             values (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            guardianId,
            text(x.guardianName),
            guardianEmail,
            text(x.guardianPhone),
            text(x.relationship) || "Guardian",
            text(x.address) || null,
            text(x.postcode) || null,
            text(x.emergencyContactNumber) || null,
          ),
        );
      }

      const existingLink = await first<{ id: string }>(
        `select id
         from student_guardians
         where student_id = ? and guardian_id = ?
         limit 1`,
        studentId,
        guardianId,
      );

      if (!existingLink) {
        statements.push(
          db.prepare(
            `insert into student_guardians
               (id, student_id, guardian_id, is_primary, authorised_collection)
             values (?, ?, ?, 1, 1)`,
          ).bind(
            crypto.randomUUID(),
            studentId,
            guardianId,
          ),
        );
      }

      statements.push(
        db.prepare(
          `insert into audit_log
             (id, user_id, action, entity_type, entity_id, details)
           values (?, ?, 'guardian-bulk-update', 'students', ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          who.id,
          studentId,
          JSON.stringify({
            studentNumber: text(x.studentNumber),
            guardianEmail,
            action: item.action,
          }),
        ),
      );

      await db.batch(statements);

      if (!provisionedEmails.has(guardianEmail)) {
        provisionedEmails.add(guardianEmail);

        const portalAccess =
          await provisionGuardianPortalAccess(
            guardianId,
            requestOrigin,
          );

        portalMessages.push({
          email:
            guardianEmail,
          status:
            portalAccess.status,
          message:
            portalAccess.message,
        });

        if (portalAccess.status === "sent") {
          portalSetupSent += 1;
        }
        else if (portalAccess.status === "added") {
          portalAccessAdded += 1;
        }
        else if (portalAccess.status === "existing") {
          portalExisting += 1;
        }
        else {
          portalFailed += 1;
        }
      }

      if (item.action === "update") updated += 1;
      else linked += 1;
    } catch (error) {
      errors.push({
        rowNumber: item.rowNumber,
        error: error instanceof Error
          ? error.message
          : "Unable to update this guardian row.",
      });
    }
  }

  return {
    linked,
    updated,
    skipped,
    failed: errors.length,
    errors,
    portalAccess: {
      setupEmailsSent:
        portalSetupSent,
      existingAccountsGrantedParentAccess:
        portalAccessAdded,
      existingParentAccountsReused:
        portalExisting,
      failed:
        portalFailed,
      messages:
        portalMessages,
    },
  };
}

export async function GET(request: Request) {
  try {
    await actor(request, ["admin"]);

    const classes = await loadClasses();
    const missingGuardians = await all(
      `select
         s.id,
         s.student_number,
         s.first_name || ' ' || s.last_name as student_name,
         s.gender,
         group_concat(distinct c.name) as class_name
       from students s
       left join student_guardians sg
         on sg.student_id = s.id
       left join enrolments e
         on e.student_id = s.id
        and e.status = 'active'
       left join classes c
         on c.id = e.class_id
       where
         s.status != 'inactive'
         and sg.id is null
       group by s.id
       order by s.last_name, s.first_name
       limit 500`,
    );

    return json({
      ok: true,
      classes,
      missingGuardianCount: missingGuardians.length,
      missingGuardians,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const input = await body(request);

    const mode = text(input.mode) as ImportMode;
    const action = text(input.action) || "preview";
    const rows = Array.isArray(input.rows)
      ? input.rows.filter((item): item is Row => Boolean(item) && typeof item === "object")
      : [];

    if (![
      "standard_students",
      "legacy_students",
      "guardian_updates",
    ].includes(mode)) {
      throw new ApiError(400, "Unknown bulk import mode.");
    }

    if (!rows.length) {
      throw new ApiError(400, "The spreadsheet does not contain any student rows.");
    }

    if (rows.length > 1000) {
      throw new ApiError(400, "A maximum of 1,000 rows can be processed in one import.");
    }

    const preview = mode === "guardian_updates"
      ? await guardianPreview(rows)
      : await studentPreview(mode, rows);

    const summary = previewSummary(preview);

    if (action === "preview") {
      return json({
        ok: true,
        mode,
        summary,
        rows: preview,
      });
    }

    if (action !== "commit") {
      throw new ApiError(400, "Unknown import action.");
    }

    if (summary.error > 0) {
      throw new ApiError(
        409,
        `${summary.error} row${summary.error === 1 ? " has" : "s have"} validation errors. Correct them before importing.`,
      );
    }

    const result = mode === "guardian_updates"
      ? await commitGuardians(
          who,
          preview,
          new URL(request.url).origin,
        )
      : await commitStudents(who, mode, preview);

    return json({
      ok: true,
      mode,
      summary,
      result,
    });
  } catch (error) {
    return fail(error);
  }
}
