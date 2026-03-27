-- Convert class slugs to unique 4-digit numeric codes
-- Example: 0427, 9183, 5601

ALTER TABLE classes
ALTER COLUMN slug TYPE VARCHAR(4);

DO $$
DECLARE
  rec RECORD;
  generated_code TEXT;
BEGIN
  FOR rec IN SELECT id FROM classes LOOP
    LOOP
      generated_code := lpad((floor(random() * 10000))::int::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM classes c
        WHERE c.slug = generated_code
          AND c.id <> rec.id
      );
    END LOOP;

    UPDATE classes
    SET slug = generated_code
    WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE classes
ALTER COLUMN slug SET NOT NULL;

ALTER TABLE classes
DROP CONSTRAINT IF EXISTS classes_slug_numeric_4_check;

ALTER TABLE classes
ADD CONSTRAINT classes_slug_numeric_4_check CHECK (slug ~ '^[0-9]{4}$');
