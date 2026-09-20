-- BNMC Communication Centre
-- Evolves the existing announcements table into a combined
-- Messages + Announcements communication store while preserving
-- all existing announcement records.

ALTER TABLE announcements ADD COLUMN kind TEXT NOT NULL DEFAULT 'announcement';
ALTER TABLE announcements ADD COLUMN audience_type TEXT NOT NULL DEFAULT 'all_parents';
ALTER TABLE announcements ADD COLUMN target_id TEXT;
ALTER TABLE announcements ADD COLUMN channel TEXT NOT NULL DEFAULT 'app';
ALTER TABLE announcements ADD COLUMN sent_at TEXT;
ALTER TABLE announcements ADD COLUMN recipient_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN email_sent_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN email_failed_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS announcements_kind_status_date_idx
  ON announcements(kind, status, sent_at, created_at);

CREATE INDEX IF NOT EXISTS announcements_target_idx
  ON announcements(audience_type, target_id);

CREATE TABLE IF NOT EXISTS communication_recipients (
  id TEXT PRIMARY KEY,
  communication_id TEXT NOT NULL,
  guardian_id TEXT,
  user_id TEXT,
  email TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'not_requested',
  provider_message_id TEXT,
  email_error TEXT,
  email_sent_at TEXT,
  app_status TEXT NOT NULL DEFAULT 'not_requested',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (communication_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS communication_recipients_communication_idx
  ON communication_recipients(communication_id);

CREATE INDEX IF NOT EXISTS communication_recipients_user_idx
  ON communication_recipients(user_id, app_status, read_at);

CREATE INDEX IF NOT EXISTS communication_recipients_guardian_idx
  ON communication_recipients(guardian_id);

CREATE INDEX IF NOT EXISTS communication_recipients_email_idx
  ON communication_recipients(email_status, email);

-- Existing records remain announcements and remain app-only.
UPDATE announcements
SET
  kind = 'announcement',
  audience_type = CASE
    WHEN lower(audience) IN ('all', 'parents', 'all parents') THEN 'all_parents'
    ELSE audience_type
  END,
  channel = 'app',
  sent_at = CASE
    WHEN status = 'published' THEN coalesce(sent_at, created_at)
    ELSE sent_at
  END,
  updated_at = CURRENT_TIMESTAMP;
