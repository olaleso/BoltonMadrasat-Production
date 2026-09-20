-- BNMC MADRASAH - PRODUCTION DATA CLEANUP
-- Preserves admin/teacher/finance/safeguarding users,
-- classes, fee plans and app settings.

DELETE FROM invoice_payment_allocations;
DELETE FROM receipts;
DELETE FROM payment_transactions;
DELETE FROM payment_webhook_events;

DELETE FROM fee_invoices;
DELETE FROM student_fee_agreements;

DELETE FROM payments;
DELETE FROM fees;

DELETE FROM direct_debit_mandates;

DELETE FROM progress;
DELETE FROM attendance;
DELETE FROM enrolments;

DELETE FROM applications;
DELETE FROM student_guardians;

DELETE FROM students;
DELETE FROM guardians;

-- Remove parent login accounts only.
DELETE FROM users
WHERE role = 'parent';

-- Clear test-environment audit history.
DELETE FROM audit_log;
