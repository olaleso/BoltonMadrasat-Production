-- BNMC failed-email delivery log and resend support

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS email_delivery_log_status_idx
  ON email_delivery_log(status, last_attempt_at);

CREATE INDEX IF NOT EXISTS email_delivery_log_recipient_idx
  ON email_delivery_log(recipient_email);

CREATE INDEX IF NOT EXISTS email_delivery_log_entity_idx
  ON email_delivery_log(related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS email_delivery_log_type_idx
  ON email_delivery_log(email_type);
