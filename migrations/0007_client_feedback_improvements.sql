ALTER TABLE media_gallery ADD COLUMN use_in_carousel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_gallery ADD COLUMN carousel_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS media_gallery_carousel_idx
  ON media_gallery(status, media_type, use_in_carousel, carousel_sort_order, created_at);
