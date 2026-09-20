-- BNMC Fee Reconciliation v1
-- Monthly class fees + editable annual books fee + manual reconciliation.

CREATE TABLE IF NOT EXISTS class_fee_rules (
  id TEXT PRIMARY KEY,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  fee_code TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  billing_day INTEGER NOT NULL DEFAULT 1,
  charge_month INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS class_fee_rules_class_code_uq
  ON class_fee_rules(class_id, fee_code)
  WHERE class_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS class_fee_rules_global_code_uq
  ON class_fee_rules(fee_code)
  WHERE class_id IS NULL;

CREATE INDEX IF NOT EXISTS class_fee_rules_active_idx
  ON class_fee_rules(active, fee_code);

INSERT OR IGNORE INTO class_fee_rules (
  id,
  class_id,
  fee_code,
  label,
  amount_pence,
  frequency,
  billing_day,
  active,
  effective_from
)
SELECT
  'monthly-' || c.id,
  c.id,
  'madrasah',
  'Madrasah fee',
  COALESCE(
    (
      SELECT CAST(ROUND(AVG(sfa.monthly_amount_pence)) AS INTEGER)
      FROM enrolments e
      JOIN student_fee_agreements sfa
        ON sfa.student_id = e.student_id
       AND sfa.status = 'active'
      WHERE e.class_id = c.id
        AND e.status = 'active'
    ),
    3000
  ),
  'monthly',
  1,
  1,
  date('now')
FROM classes c
WHERE c.status = 'active';

INSERT OR IGNORE INTO class_fee_rules (
  id,
  class_id,
  fee_code,
  label,
  amount_pence,
  frequency,
  billing_day,
  charge_month,
  active,
  effective_from
)
VALUES (
  'books-global',
  NULL,
  'books',
  'Books fee',
  1000,
  'annual',
  1,
  9,
  1,
  date('now')
);

ALTER TABLE fee_invoices
  ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'madrasah';

ALTER TABLE fee_invoices
  ADD COLUMN class_id TEXT REFERENCES classes(id) ON DELETE SET NULL;

ALTER TABLE fee_invoices
  ADD COLUMN academic_year_key TEXT;

ALTER TABLE fee_invoices
  ADD COLUMN fee_frequency TEXT;

ALTER TABLE fee_invoices
  ADD COLUMN fee_rule_id TEXT REFERENCES class_fee_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fee_invoices_class_period_idx
  ON fee_invoices(class_id, billing_year, billing_month, fee_type);

CREATE INDEX IF NOT EXISTS fee_invoices_academic_year_type_idx
  ON fee_invoices(student_id, academic_year_key, fee_type);

CREATE UNIQUE INDEX IF NOT EXISTS fee_invoice_student_class_type_period_uq
  ON fee_invoices(student_id, class_id, fee_type, billing_year, billing_month)
  WHERE class_id IS NOT NULL;
