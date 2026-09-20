CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`audience` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_audience_status_idx` ON `announcements` (`audience`,`status`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`preferred_session` text,
	`prior_level` text,
	`status` text DEFAULT 'payment_pending' NOT NULL,
	`application_fee_pence` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text,
	`reviewed_by` text,
	`review_notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_student_uq` ON `applications` (`student_id`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`session_date` text NOT NULL,
	`status` text NOT NULL,
	`arrival_time` text,
	`collection_time` text,
	`collected_by_guardian_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collected_by_guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_student_class_date_uq` ON `attendance` (`student_id`,`class_id`,`session_date`);--> statement-breakpoint
CREATE INDEX `attendance_class_date_idx` ON `attendance` (`class_id`,`session_date`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_user_date_idx` ON `audit_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`level` text NOT NULL,
	`teacher_id` text,
	`room` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`capacity` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `classes_teacher_day_idx` ON `classes` (`teacher_id`,`day_of_week`);--> statement-breakpoint
CREATE INDEX `classes_status_idx` ON `classes` (`status`);--> statement-breakpoint
CREATE TABLE `compliance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`check_type` text NOT NULL,
	`status` text NOT NULL,
	`completed_at` text,
	`expires_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `compliance_user_status_idx` ON `compliance` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `compliance_expiry_idx` ON `compliance` (`expires_at`);--> statement-breakpoint
CREATE TABLE `direct_debit_mandates` (
	`id` text PRIMARY KEY NOT NULL,
	`guardian_id` text NOT NULL,
	`provider` text DEFAULT 'gocardless' NOT NULL,
	`provider_customer_id` text,
	`provider_mandate_id` text,
	`provider_billing_request_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheme` text DEFAULT 'bacs' NOT NULL,
	`last4` text,
	`bank_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `direct_debit_provider_mandate_uq` ON `direct_debit_mandates` (`provider`,`provider_mandate_id`);--> statement-breakpoint
CREATE INDEX `direct_debit_guardian_status_idx` ON `direct_debit_mandates` (`guardian_id`,`status`);--> statement-breakpoint
CREATE TABLE `enrolments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`enrolled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrolments_student_class_uq` ON `enrolments` (`student_id`,`class_id`);--> statement-breakpoint
CREATE INDEX `enrolments_class_status_idx` ON `enrolments` (`class_id`,`status`);--> statement-breakpoint
CREATE TABLE `fee_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`agreement_id` text,
	`billing_year` integer NOT NULL,
	`billing_month` integer NOT NULL,
	`description` text NOT NULL,
	`amount_pence` integer NOT NULL,
	`discount_pence` integer DEFAULT 0 NOT NULL,
	`amount_due_pence` integer NOT NULL,
	`amount_paid_pence` integer DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agreement_id`) REFERENCES `student_fee_agreements`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_invoice_agreement_period_uq` ON `fee_invoices` (`agreement_id`,`billing_year`,`billing_month`);--> statement-breakpoint
CREATE INDEX `fee_invoices_student_status_idx` ON `fee_invoices` (`student_id`,`status`);--> statement-breakpoint
CREATE INDEX `fee_invoices_due_status_idx` ON `fee_invoices` (`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `fee_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`amount_pence` integer NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fee_plans_active_idx` ON `fee_plans` (`active`);--> statement-breakpoint
CREATE TABLE `fees` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`description` text NOT NULL,
	`amount_pence` integer NOT NULL,
	`discount_pence` integer DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'outstanding' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fees_student_status_idx` ON `fees` (`student_id`,`status`);--> statement-breakpoint
CREATE INDEX `fees_due_status_idx` ON `fees` (`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text,
	`relationship` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardians_email_uq` ON `guardians` (`email`);--> statement-breakpoint
CREATE INDEX `guardians_user_idx` ON `guardians` (`user_id`);--> statement-breakpoint
CREATE TABLE `invoice_payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`amount_pence` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `fee_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_payment_allocation_uq` ON `invoice_payment_allocations` (`invoice_id`,`transaction_id`);--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text,
	`student_id` text,
	`guardian_id` text,
	`invoice_id` text,
	`provider` text NOT NULL,
	`provider_reference` text,
	`provider_customer_id` text,
	`amount_pence` integer NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`initiated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text,
	`failure_code` text,
	`failure_message` text,
	`metadata_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invoice_id`) REFERENCES `fee_invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_provider_ref_uq` ON `payment_transactions` (`provider`,`provider_reference`);--> statement-breakpoint
CREATE INDEX `payment_transactions_application_idx` ON `payment_transactions` (`application_id`,`status`);--> statement-breakpoint
CREATE INDEX `payment_transactions_invoice_idx` ON `payment_transactions` (`invoice_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text,
	`status` text DEFAULT 'received' NOT NULL,
	`error_message` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_provider_event_uq` ON `payment_webhook_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`fee_id` text,
	`amount_pence` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`recorded_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fee_id`) REFERENCES `fees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_fee_date_idx` ON `payments` (`fee_id`,`received_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_reference_uq` ON `payments` (`reference`);--> statement-breakpoint
CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`strand` text NOT NULL,
	`current_unit` text NOT NULL,
	`achievement` text NOT NULL,
	`score` integer,
	`teacher_comment` text,
	`next_step` text,
	`assessed_at` text NOT NULL,
	`recorded_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `progress_student_date_idx` ON `progress` (`student_id`,`assessed_at`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_number` text NOT NULL,
	`transaction_id` text NOT NULL,
	`guardian_id` text,
	`student_id` text,
	`amount_pence` integer NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`purpose` text NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `payment_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_number_uq` ON `receipts` (`receipt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_transaction_uq` ON `receipts` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_uq` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_expiry_idx` ON `sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `student_fee_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`fee_plan_id` text,
	`monthly_amount_pence` integer NOT NULL,
	`discount_pence` integer DEFAULT 0 NOT NULL,
	`billing_day` integer DEFAULT 1 NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`collection_method` text DEFAULT 'direct_debit' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fee_plan_id`) REFERENCES `fee_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `student_fee_agreements_student_idx` ON `student_fee_agreements` (`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `student_guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`authorised_collection` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_guardian_uq` ON `student_guardians` (`student_id`,`guardian_id`);--> statement-breakpoint
CREATE INDEX `student_guardian_guardian_idx` ON `student_guardians` (`guardian_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`student_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`gender` text NOT NULL,
	`medical_notes` text,
	`allergy_notes` text,
	`additional_needs` text,
	`photo_consent` integer DEFAULT false NOT NULL,
	`emergency_consent` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'applicant' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_number_uq` ON `students` (`student_number`);--> statement-breakpoint
CREATE INDEX `students_status_name_idx` ON `students` (`status`,`last_name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_status_idx` ON `users` (`role`,`status`);