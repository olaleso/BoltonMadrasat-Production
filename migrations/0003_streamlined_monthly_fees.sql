-- One-admin billing: one standard GBP 30 monthly fee.
-- Existing invoices and payment history are deliberately preserved.

UPDATE fee_plans
SET
  active = 0,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO fee_plans
  (
    id,
    name,
    frequency,
    amount_pence,
    currency,
    active
  )
VALUES
  (
    'standard-monthly-30',
    'Monthly Madrasah Fee',
    'monthly',
    3000,
    'GBP',
    1
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  frequency = excluded.frequency,
  amount_pence = excluded.amount_pence,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = CURRENT_TIMESTAMP;

-- All active agreements now follow the single standard plan.
UPDATE student_fee_agreements
SET
  fee_plan_id = 'standard-monthly-30',
  monthly_amount_pence = 3000,
  billing_day = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE status = 'active';

