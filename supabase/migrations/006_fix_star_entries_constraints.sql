-- Migration 006: Fix star_entries constraints
-- Ensure we have a unique constraint for upserting star entries.
-- We include 'type' to distinguish between lesson stars and other possible types (bonus/penalty).

-- Clean up any potential duplicates first (keep the most recent one)
DELETE FROM star_entries a
USING star_entries b
WHERE a.id < b.id
  AND a.student_id = b.student_id
  AND (a.lesson_id = b.lesson_id OR (a.lesson_id IS NULL AND b.lesson_id IS NULL))
  AND a.type = b.type;

-- Remove old constraint if it exists
ALTER TABLE star_entries DROP CONSTRAINT IF EXISTS unique_student_lesson_star;

-- Add new unique constraint
-- Note: In Postgres 15+, we could use UNIQUE NULLS NOT DISTINCT (student_id, lesson_id, type)
-- But for compatibility, we'll use a separate unique index for cases where lesson_id is null if needed.
-- For now, the main issue is lesson stars where lesson_id is NOT NULL.
ALTER TABLE star_entries 
ADD CONSTRAINT unique_student_lesson_type_star 
UNIQUE (student_id, lesson_id, type);
