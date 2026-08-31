import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", [
  "admin",
  "teacher",
  "finance",
  "safeguarding",
  "parent",
]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
const stamp = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    ...stamp(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_status_idx").on(t.role, t.status),
  ],
);
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_user_expiry_idx").on(t.userId, t.expiresAt),
  ],
);
export const guardians = pgTable(
  "guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    relationship: text("relationship").notNull(),
    ...stamp(),
  },
  (t) => [
    index("guardians_user_idx").on(t.userId),
    uniqueIndex("guardians_email_uq").on(t.email),
  ],
);
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentNumber: text("student_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    gender: text("gender").notNull(),
    medicalNotes: text("medical_notes"),
    allergyNotes: text("allergy_notes"),
    additionalNeeds: text("additional_needs"),
    photoConsent: boolean("photo_consent").notNull().default(false),
    emergencyConsent: boolean("emergency_consent").notNull().default(false),
    status: text("status").notNull().default("applicant"),
    ...stamp(),
  },
  (t) => [
    uniqueIndex("students_number_uq").on(t.studentNumber),
    index("students_status_name_idx").on(t.status, t.lastName),
  ],
);
export const studentGuardians = pgTable(
  "student_guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    authorisedCollection: boolean("authorised_collection")
      .notNull()
      .default(true),
    ...stamp(),
  },
  (t) => [
    uniqueIndex("student_guardian_uq").on(t.studentId, t.guardianId),
    index("student_guardian_guardian_idx").on(t.guardianId),
  ],
);
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    preferredSession: text("preferred_session"),
    priorLevel: text("prior_level"),
    status: text("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes"),
    ...stamp(),
  },
  (t) => [
    index("applications_status_idx").on(t.status, t.submittedAt),
    uniqueIndex("applications_student_uq").on(t.studentId),
  ],
);
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    level: text("level").notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    room: text("room").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    capacity: integer("capacity").notNull(),
    status: text("status").notNull().default("active"),
    ...stamp(),
  },
  (t) => [
    index("classes_teacher_day_idx").on(t.teacherId, t.dayOfWeek),
    index("classes_status_idx").on(t.status),
  ],
);
export const enrolments = pgTable(
  "enrolments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("active"),
    ...stamp(),
  },
  (t) => [
    uniqueIndex("enrolments_student_class_uq").on(t.studentId, t.classId),
    index("enrolments_class_status_idx").on(t.classId, t.status),
  ],
);
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),
    status: text("status").notNull(),
    arrivalTime: text("arrival_time"),
    collectionTime: text("collection_time"),
    collectedByGuardianId: uuid("collected_by_guardian_id").references(
      () => guardians.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...stamp(),
  },
  (t) => [
    uniqueIndex("attendance_student_class_date_uq").on(
      t.studentId,
      t.classId,
      t.sessionDate,
    ),
    index("attendance_class_date_idx").on(t.classId, t.sessionDate, t.status),
  ],
);
export const progress = pgTable(
  "progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    strand: text("strand").notNull(),
    currentUnit: text("current_unit").notNull(),
    achievement: text("achievement").notNull(),
    score: integer("score"),
    teacherComment: text("teacher_comment"),
    nextStep: text("next_step"),
    assessedAt: date("assessed_at").notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...stamp(),
  },
  (t) => [
    index("progress_student_strand_idx").on(
      t.studentId,
      t.strand,
      t.assessedAt,
    ),
    index("progress_class_idx").on(t.classId, t.assessedAt),
  ],
);
export const fees = pgTable(
  "fees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amountPence: integer("amount_pence").notNull(),
    discountPence: integer("discount_pence").notNull().default(0),
    dueDate: date("due_date").notNull(),
    status: text("status").notNull().default("due"),
    ...stamp(),
  },
  (t) => [
    index("fees_student_status_idx").on(t.studentId, t.status),
    index("fees_due_status_idx").on(t.dueDate, t.status),
  ],
);
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feeId: uuid("fee_id")
      .notNull()
      .references(() => fees.id, { onDelete: "cascade" }),
    amountPence: integer("amount_pence").notNull(),
    method: text("method").notNull(),
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedBy: uuid("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...stamp(),
  },
  (t) => [
    index("payments_fee_date_idx").on(t.feeId, t.receivedAt),
    uniqueIndex("payments_reference_uq").on(t.reference),
  ],
);
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audience: text("audience").notNull(),
    status: text("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...stamp(),
  },
  (t) => [index("announcements_status_idx").on(t.status, t.scheduledAt)],
);
export const staffCompliance = pgTable(
  "staff_compliance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkType: text("check_type").notNull(),
    status: text("status").notNull(),
    completedAt: date("completed_at"),
    expiresAt: date("expires_at"),
    notes: text("notes"),
    ...stamp(),
  },
  (t) => [
    index("compliance_expiry_idx").on(t.expiresAt, t.status),
    index("compliance_user_idx").on(t.userId),
  ],
);
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId, t.occurredAt),
    index("audit_actor_idx").on(t.actorUserId, t.occurredAt),
  ],
);
