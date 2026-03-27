-- Enforce global individual prize thresholds for all classes:
-- Кіндер = 10, Стікер = 20, ПІН = 30, 3D-друк = 50

UPDATE prizes_individual
SET stars_required = CASE
  WHEN lower(name) LIKE '%кіндер%' THEN 10
  WHEN lower(name) LIKE '%стікер%' OR lower(name) LIKE '%стікер%' THEN 20
  WHEN lower(name) LIKE '%пін%' THEN 30
  WHEN lower(name) LIKE '%3д%' OR lower(name) LIKE '%3d%' THEN 50
  ELSE stars_required
END;

-- Ensure classes have non-guessable, unique 4-char codes (A-Z, 0-9)
ALTER TABLE classes
ALTER COLUMN slug TYPE VARCHAR(4);

DO $$
DECLARE
  rec RECORD;
  generated_code TEXT;
BEGIN
  FOR rec IN SELECT id, slug FROM classes LOOP
    IF rec.slug IS NULL OR rec.slug ~ '^[0-9][A-Z].*' OR length(rec.slug) <> 4 THEN
      LOOP
        generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
        generated_code := regexp_replace(generated_code, '[^A-Z0-9]', 'A', 'g');

        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM classes c
          WHERE c.slug = generated_code
            AND c.id <> rec.id
        );
      END LOOP;

      UPDATE classes
      SET slug = generated_code
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE classes
ALTER COLUMN slug SET NOT NULL;
