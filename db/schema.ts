import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_status_idx").on(t.role, t.status)]);

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex("user_roles_user_role_uq").on(t.userId, t.role),
  index("user_roles_role_user_idx").on(t.role, t.userId),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_expiry_idx").on(t.userId, t.expiresAt)]);

export const passwordAccessTokens = sqliteTable("password_access_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex("password_access_tokens_hash_uq").on(t.tokenHash),
  index("password_access_tokens_user_expiry_idx").on(t.userId, t.expiresAt),
]);

export const guardians = sqliteTable("guardians", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  postcode: text("postcode"),
  emergencyContactNumber: text("emergency_contact_number"),
  relationship: text("relationship").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("guardians_email_uq").on(t.email), index("guardians_user_idx").on(t.userId)]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  studentNumber: text("student_number").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  gender: text("gender").notNull(),
  ethnicGroup: text("ethnic_group"),
  medicalNotes: text("medical_notes"),
  allergyNotes: text("allergy_notes"),
  additionalNeeds: text("additional_needs"),
  photoConsent: integer("photo_consent", { mode: "boolean" }).notNull().default(false),
  emergencyConsent: integer("emergency_consent", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("applicant"),
  ...timestamps,
}, (t) => [uniqueIndex("students_number_uq").on(t.studentNumber), index("students_status_name_idx").on(t.status, t.lastName)]);

export const studentGuardians = sqliteTable("student_guardians", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: text("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  authorisedCollection: integer("authorised_collection", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("student_guardian_uq").on(t.studentId, t.guardianId), index("student_guardian_guardian_idx").on(t.guardianId)]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  preferredSession: text("preferred_session"),
  priorLevel: text("prior_level"),
  status: text("status").notNull().default("payment_pending"),
  applicationFeePence: integer("application_fee_pence").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("pending"),
  submittedAt: text("submitted_at"),
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  ...timestamps,
}, (t) => [index("applications_status_idx").on(t.status, t.createdAt), uniqueIndex("applications_student_uq").on(t.studentId)]);

export const classCategories = sqliteTable("class_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (t) => [
  index("class_categories_status_sort_idx").on(t.status, t.sortOrder, t.name),
]);

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  level: text("level").notNull(),
  categoryId: text("category_id"),
  teacherId: text("teacher_id").references(() => users.id, { onDelete: "set null" }),
  room: text("room").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [index("classes_teacher_day_idx").on(t.teacherId, t.dayOfWeek), index("classes_status_idx").on(t.status)]);

export const enrolments = sqliteTable("enrolments", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  enrolledAt: text("enrolled_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [uniqueIndex("enrolments_student_class_uq").on(t.studentId, t.classId), index("enrolments_class_status_idx").on(t.classId, t.status)]);

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  sessionDate: text("session_date").notNull(),
  status: text("status").notNull(),
  arrivalTime: text("arrival_time"),
  collectionTime: text("collection_time"),
  collectedByGuardianId: text("collected_by_guardian_id").references(() => guardians.id, { onDelete: "set null" }),
  notes: text("notes"),
  ...timestamps,
}, (t) => [uniqueIndex("attendance_student_class_date_uq").on(t.studentId, t.classId, t.sessionDate), index("attendance_class_date_idx").on(t.classId, t.sessionDate)]);

export const progress = sqliteTable("progress", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  strand: text("strand").notNull(),
  currentUnit: text("current_unit").notNull(),
  achievement: text("achievement").notNull(),
  score: integer("score"),
  teacherComment: text("teacher_comment"),
  nextStep: text("next_step"),
  assessedAt: text("assessed_at").notNull(),
  recordedBy: text("recorded_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("progress_student_date_idx").on(t.studentId, t.assessedAt)]);

// Legacy fee/payment tables retained during migration so existing portal screens can keep working.
export const fees = sqliteTable("fees", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amountPence: integer("amount_pence").notNull(),
  discountPence: integer("discount_pence").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("outstanding"),
  ...timestamps,
}, (t) => [index("fees_student_status_idx").on(t.studentId, t.status), index("fees_due_status_idx").on(t.dueDate, t.status)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  feeId: text("fee_id").references(() => fees.id, { onDelete: "set null" }),
  amountPence: integer("amount_pence").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  recordedBy: text("recorded_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("payments_fee_date_idx").on(t.feeId, t.receivedAt), uniqueIndex("payments_reference_uq").on(t.reference)]);

// UK fee configuration and monthly billing.
export const feePlans = sqliteTable("fee_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("GBP"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (t) => [index("fee_plans_active_idx").on(t.active)]);

export const studentFeeAgreements = sqliteTable("student_fee_agreements", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  feePlanId: text("fee_plan_id").references(() => feePlans.id, { onDelete: "set null" }),
  monthlyAmountPence: integer("monthly_amount_pence").notNull(),
  discountPence: integer("discount_pence").notNull().default(0),
  billingDay: integer("billing_day").notNull().default(1),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  collectionMethod: text("collection_method").notNull().default("direct_debit"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [index("student_fee_agreements_student_idx").on(t.studentId, t.status)]);

export const feeInvoices = sqliteTable("fee_invoices", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  agreementId: text("agreement_id").references(() => studentFeeAgreements.id, { onDelete: "set null" }),
  billingYear: integer("billing_year").notNull(),
  billingMonth: integer("billing_month").notNull(),
  description: text("description").notNull(),
  amountPence: integer("amount_pence").notNull(),
  discountPence: integer("discount_pence").notNull().default(0),
  amountDuePence: integer("amount_due_pence").notNull(),
  amountPaidPence: integer("amount_paid_pence").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  ...timestamps,
}, (t) => [
  uniqueIndex("fee_invoice_agreement_period_uq").on(t.agreementId, t.billingYear, t.billingMonth),
  index("fee_invoices_student_status_idx").on(t.studentId, t.status),
  index("fee_invoices_due_status_idx").on(t.dueDate, t.status),
]);

export const paymentTransactions = sqliteTable("payment_transactions", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }),
  studentId: text("student_id").references(() => students.id, { onDelete: "set null" }),
  guardianId: text("guardian_id").references(() => guardians.id, { onDelete: "set null" }),
  invoiceId: text("invoice_id").references(() => feeInvoices.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference"),
  providerCustomerId: text("provider_customer_id"),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("GBP"),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("pending"),
  initiatedAt: text("initiated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  paidAt: text("paid_at"),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  metadataJson: text("metadata_json"),
  ...timestamps,
}, (t) => [
  uniqueIndex("payment_transactions_provider_ref_uq").on(t.provider, t.providerReference),
  index("payment_transactions_application_idx").on(t.applicationId, t.status),
  index("payment_transactions_invoice_idx").on(t.invoiceId, t.status),
]);

export const directDebitMandates = sqliteTable("direct_debit_mandates", {
  id: text("id").primaryKey(),
  guardianId: text("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("gocardless"),
  providerCustomerId: text("provider_customer_id"),
  providerMandateId: text("provider_mandate_id"),
  providerBillingRequestId: text("provider_billing_request_id"),
  status: text("status").notNull().default("pending"),
  scheme: text("scheme").notNull().default("bacs"),
  last4: text("last4"),
  bankName: text("bank_name"),
  ...timestamps,
}, (t) => [
  uniqueIndex("direct_debit_provider_mandate_uq").on(t.provider, t.providerMandateId),
  index("direct_debit_guardian_status_idx").on(t.guardianId, t.status),
]);

export const invoicePaymentAllocations = sqliteTable("invoice_payment_allocations", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id").notNull().references(() => paymentTransactions.id, { onDelete: "cascade" }),
  amountPence: integer("amount_pence").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("invoice_payment_allocation_uq").on(t.invoiceId, t.transactionId)]);

export const paymentWebhookEvents = sqliteTable("payment_webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash"),
  status: text("status").notNull().default("received"),
  errorMessage: text("error_message"),
  receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  processedAt: text("processed_at"),
}, (t) => [uniqueIndex("payment_webhook_provider_event_uq").on(t.provider, t.providerEventId)]);

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull(),
  transactionId: text("transaction_id").notNull().references(() => paymentTransactions.id, { onDelete: "cascade" }),
  guardianId: text("guardian_id").references(() => guardians.id, { onDelete: "set null" }),
  studentId: text("student_id").references(() => students.id, { onDelete: "set null" }),
  amountPence: integer("amount_pence").notNull(),
  currency: text("currency").notNull().default("GBP"),
  purpose: text("purpose").notNull(),
  issuedAt: text("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (t) => [uniqueIndex("receipts_number_uq").on(t.receiptNumber), uniqueIndex("receipts_transaction_uq").on(t.transactionId)]);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ...timestamps,
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull(),
  status: text("status").notNull().default("draft"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("announcements_audience_status_idx").on(t.audience, t.status)]);

export const compliance = sqliteTable("compliance", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkType: text("check_type").notNull(),
  status: text("status").notNull(),
  completedAt: text("completed_at"),
  expiresAt: text("expires_at"),
  notes: text("notes"),
  ...timestamps,
}, (t) => [index("compliance_user_status_idx").on(t.userId, t.status), index("compliance_expiry_idx").on(t.expiresAt)]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_user_date_idx").on(t.userId, t.createdAt)]);


