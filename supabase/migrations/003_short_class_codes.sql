-- Replace long slugs with short 4-char class codes
-- Format: uppercase letters + digits, e.g. A7D3

ALTER TABLE classes
ALTER COLUMN slug TYPE VARCHAR(4);

DO $$
DECLARE
  rec RECORD;
  generated_code TEXT;
BEGIN
  FOR rec IN SELECT id FROM classes LOOP
    LOOP
      generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM classes
        WHERE slug = generated_code
          AND id <> rec.id
      );
    END LOOP;

    UPDATE classes
    SET slug = generated_code
    WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE classes
ALTER COLUMN slug SET NOT NULL;
