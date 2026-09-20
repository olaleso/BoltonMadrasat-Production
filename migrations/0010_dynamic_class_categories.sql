-- 0010_dynamic_class_categories.sql
-- Make BNMC class/category structure admin-managed rather than hard-coded.

CREATE TABLE IF NOT EXISTS class_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO class_categories
  (id, name, description, status, sort_order)
VALUES
  ('bnmc-category-1', 'Category 1', 'BNMC Category 1', 'active', 10),
  ('bnmc-category-2', 'Category 2', 'BNMC Category 2', 'active', 20),
  ('bnmc-category-3', 'Category 3', 'BNMC Category 3', 'active', 30);

ALTER TABLE classes ADD COLUMN category_id TEXT;

UPDATE classes
SET category_id =
  CASE
    WHEN lower(trim(level)) = 'category 1' THEN 'bnmc-category-1'
    WHEN lower(trim(level)) = 'category 2' THEN 'bnmc-category-2'
    WHEN lower(trim(level)) = 'category 3' THEN 'bnmc-category-3'
    ELSE category_id
  END
WHERE category_id IS NULL;

CREATE INDEX IF NOT EXISTS classes_category_status_idx
  ON classes(category_id, status);

CREATE INDEX IF NOT EXISTS class_categories_status_sort_idx
  ON class_categories(status, sort_order, name);
