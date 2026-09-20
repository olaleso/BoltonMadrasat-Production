-- BNMC multi-role account model
--
-- One user/email/password may hold several portal roles.
-- The legacy users.role column is intentionally retained during the
-- transition so older code can continue to operate.

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (role IN ('admin', 'teacher', 'finance', 'safeguarding', 'parent'))
);

CREATE INDEX IF NOT EXISTS user_roles_role_user_idx
  ON user_roles(role, user_id);

-- Preserve each account's current legacy role.
INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT
  id,
  CASE
    WHEN lower(role) = 'staff' THEN 'teacher'
    ELSE lower(role)
  END
FROM users
WHERE lower(role) IN (
  'admin',
  'teacher',
  'staff',
  'finance',
  'safeguarding',
  'parent'
);

-- A linked guardian is a parent even when the same account also has
-- a staff role.
INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT DISTINCT
  user_id,
  'parent'
FROM guardians
WHERE user_id IS NOT NULL;

-- Preserve teaching access for any user already assigned to a class.
-- This also recovers Teacher + Admin accounts whose legacy users.role
-- was previously changed from teacher to admin.
INSERT OR IGNORE INTO user_roles (user_id, role)
SELECT DISTINCT
  teacher_id,
  'teacher'
FROM classes
WHERE teacher_id IS NOT NULL;
