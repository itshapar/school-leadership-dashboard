-- Add slug and individual prize thresholds to classes
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS slug VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS kinder_threshold INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS sticker_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS pin_threshold INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS three_d_threshold INTEGER DEFAULT 50;

-- Generate initial slugs for existing classes if they don't have one
-- (We'll do this properly in the seed script too, but this is a fallback)
UPDATE classes SET slug = SUBSTRING(REPLACE(id::text, '-', ''), 1, 6) WHERE slug IS NULL;
