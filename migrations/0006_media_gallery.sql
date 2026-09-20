CREATE TABLE IF NOT EXISTS media_gallery (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  media_type TEXT NOT NULL,
  storage_key TEXT,
  external_url TEXT,
  mime_type TEXT,
  file_size INTEGER,
  category TEXT NOT NULL DEFAULT 'Community',
  album TEXT,
  event_date TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  contains_students INTEGER NOT NULL DEFAULT 0,
  photo_consent_confirmed INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS media_gallery_status_date_idx
  ON media_gallery(status, event_date, created_at);

CREATE INDEX IF NOT EXISTS media_gallery_category_status_idx
  ON media_gallery(category, status);

CREATE INDEX IF NOT EXISTS media_gallery_featured_status_idx
  ON media_gallery(is_featured, status);
