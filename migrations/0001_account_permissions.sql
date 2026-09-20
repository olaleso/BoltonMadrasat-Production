CREATE TABLE IF NOT EXISTS account_permissions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1 CHECK (allowed IN (0,1)),
    granted_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS account_permissions_user_permission_uq
ON account_permissions(user_id, permission);

CREATE INDEX IF NOT EXISTS account_permissions_user_idx
ON account_permissions(user_id);
