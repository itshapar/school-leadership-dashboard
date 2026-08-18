-- 013a_public_codes_and_functions.sql
--
-- ФАЗА 1 із 2. Ця міграція НІЧОГО НЕ ЛАМАЄ: вона тільки додає нові коди класів
-- і SECURITY DEFINER функції для публічної сторінки. Стара публічна сторінка
-- продовжує працювати, поки не застосуєш 013b.
--
-- Порядок: 013a  ->  деплой коду на Vercel  ->  013b
-- Якщо кілька хвилин непрацюючої публічної сторінки не проблема — можна
-- виконати 013a і 013b підряд, а деплой зробити після.
--
-- Нічого не видаляється: жоден рядок students / star_entries / lessons /
-- prizes_* цією міграцією не змінюється і не втрачається.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Коди класів
-- ---------------------------------------------------------------------------
-- public_code — 10 символів, алфавіт без неоднозначних гліфів:
--   A B C D E F G H J K M N P Q R S T U V W X Y Z 2 3 4 5 6 7 8 9   (31 символ)
--   виключені: 0/O, 1/I/L  -> діти не плутають при наборі з дошки.
--   10 символів з 31-символьного алфавіту ≈ 49.5 біт ентропії.
-- legacy_code — старий 4-значний код (щоб не ламати роздані посилання).

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS public_code TEXT,
  ADD COLUMN IF NOT EXISTS legacy_code TEXT;

-- Нормалізація введеного користувачем коду: верхній регістр, лише [A-Z0-9].
-- Дозволяє вводити код як "K7M2P-QR9TX", "k7m2p qr9tx" або "K7M2PQR9TX".
CREATE OR REPLACE FUNCTION public.normalize_class_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Криптостійкий генератор коду (gen_random_bytes, НЕ random()).
-- SECURITY DEFINER — щоб перевірка унікальності бачила ВСІ класи, а не лише
-- видимі поточному вчителю через RLS (інакше два вчителі могли б отримати
-- однаковий код і впертись у UNIQUE вже на INSERT).
CREATE OR REPLACE FUNCTION public.generate_class_public_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
-- extensions у search_path: у Supabase pgcrypto (gen_random_bytes) встановлений
-- саме там, а не в public
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 символ
  code_len CONSTANT INT  := 10;
  candidate TEXT;
  bytes     BYTEA;
  i         INT;
BEGIN
  LOOP
    candidate := '';
    bytes := gen_random_bytes(code_len * 2);
    i := 0;
    WHILE length(candidate) < code_len LOOP
      i := i + 1;
      IF i > length(bytes) THEN
        bytes := gen_random_bytes(code_len * 2);
        i := 1;
      END IF;
      -- відкидаємо значення >= 248, щоб 256 mod 31 не давав зміщення розподілу
      IF get_byte(bytes, i - 1) < 248 THEN
        candidate := candidate || substr(alphabet, (get_byte(bytes, i - 1) % 31) + 1, 1);
      END IF;
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM classes c WHERE c.public_code = candidate);
  END LOOP;

  RETURN candidate;
END;
$$;

-- Зафіксувати старі коди як legacy (значення пораховані з lib/classCodes.ts,
-- FNV-1a hash від class id mod 10000 — саме те, що зараз у роздані посилання).
UPDATE classes SET legacy_code = '1430' WHERE id = '11111111-0000-0000-0000-000000000001' AND legacy_code IS NULL;
UPDATE classes SET legacy_code = '3811' WHERE id = '11111111-0000-0000-0000-000000000002' AND legacy_code IS NULL;
UPDATE classes SET legacy_code = '6192' WHERE id = '11111111-0000-0000-0000-000000000003' AND legacy_code IS NULL;
UPDATE classes SET legacy_code = '9525' WHERE id = '11111111-0000-0000-0000-000000000004' AND legacy_code IS NULL;
UPDATE classes SET legacy_code = '1906' WHERE id = '11111111-0000-0000-0000-000000000005' AND legacy_code IS NULL;
UPDATE classes SET legacy_code = '4287' WHERE id = '11111111-0000-0000-0000-000000000006' AND legacy_code IS NULL;

-- Видати новий код кожному класу, який його ще не має.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM classes WHERE public_code IS NULL LOOP
    UPDATE classes SET public_code = public.generate_class_public_code() WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE classes ALTER COLUMN public_code SET NOT NULL;
ALTER TABLE classes ALTER COLUMN public_code SET DEFAULT public.generate_class_public_code();

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_public_code_key;
ALTER TABLE classes ADD CONSTRAINT classes_public_code_key UNIQUE (public_code);
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_legacy_code_key;
ALTER TABLE classes ADD CONSTRAINT classes_legacy_code_key UNIQUE (legacy_code);

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_public_code_format_check;
ALTER TABLE classes ADD CONSTRAINT classes_public_code_format_check
  CHECK (public_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$');

-- ---------------------------------------------------------------------------
-- 2. Внутрішні хелпери (НЕ гранаються anon — викликаються всередині
--    SECURITY DEFINER функцій, тобто від імені власника)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_class_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM classes c
  WHERE public.normalize_class_code(p_code) <> ''
    AND (
      c.public_code = public.normalize_class_code(p_code)
      OR c.legacy_code = public.normalize_class_code(p_code)
    )
  LIMIT 1;
$$;

-- Публічне ім'я учня. full_name НІКОЛИ не виходить назовні.
-- Формат ПІБ у цій базі — «Прізвище Ім'я» (перевірено на даних: 0 з 87 перших
-- слів є іменем, 67 з 87 других — є). Тому fallback бере ДРУГЕ слово.
-- Якщо nickname порожній і другого слова немає — віддаємо нейтральне «Учень»,
-- щоб у жодному разі не показати прізвище.
CREATE OR REPLACE FUNCTION public.student_display_name(p_nickname TEXT, p_full_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    nullif(btrim(coalesce(p_nickname, '')), ''),
    nullif(split_part(btrim(coalesce(p_full_name, '')), ' ', 2), ''),
    'Учень'
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_class_by_code(TEXT)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_display_name(TEXT, TEXT)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_class_public_code()        FROM PUBLIC, anon;
-- потрібен вчителю: це DEFAULT для classes.public_code, тобто виконується
-- від імені того, хто робить INSERT нового класу
GRANT  EXECUTE ON FUNCTION public.generate_class_public_code()    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.normalize_class_code(TEXT)      TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Публічний API: рівно дві функції, обидві приймають КОД КЛАСУ
--    і віддають ЛИШЕ дані цього класу, без full_name.
-- ---------------------------------------------------------------------------

-- 3.1. Головна публічна сторінка класу
CREATE OR REPLACE FUNCTION public.public_class_overview(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_class_id       UUID;
  v_norm           TEXT := public.normalize_class_code(p_code);
  v_result         JSONB;
BEGIN
  v_class_id := public.resolve_class_by_code(p_code);
  -- Один і той самий NULL і для неіснуючого коду, і для будь-якого сміття:
  -- жодного oracle для перебору.
  IF v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'class_id',            c.id,
    'name',                c.name,
    'public_code',         c.public_code,
    'requested_legacy',    (c.public_code IS DISTINCT FROM v_norm),
    'game_day_threshold',  c.game_day_threshold,
    'pizza_day_threshold', c.pizza_day_threshold,
    'personal_stars',      coalesce(agg.personal_stars, 0),
    'class_bonus',         coalesce(agg.class_bonus, 0),
    'total_stars',         coalesce(agg.personal_stars, 0) + coalesce(agg.class_bonus, 0),
    'class_entries',       coalesce(ce.items, '[]'::jsonb),
    'students',            coalesce(st.items, '[]'::jsonb)
  )
  INTO v_result
  FROM classes c
  LEFT JOIN LATERAL (
    SELECT
      coalesce(sum(e.amount) FILTER (WHERE e.student_id IS NOT NULL AND e.amount > 0), 0)::int AS personal_stars,
      coalesce(sum(e.amount) FILTER (WHERE e.student_id IS NULL), 0)::int                      AS class_bonus
    FROM star_entries e
    WHERE e.class_id = c.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'amount',     e.amount,
               'note',       e.note,
               'created_at', e.created_at
             ) ORDER BY e.created_at DESC
           ) AS items
    FROM star_entries e
    WHERE e.class_id = c.id AND e.student_id IS NULL
  ) ce ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object(
               'id',           x.id,
               'display_name', x.display_name,
               'avatar_emoji', x.avatar_emoji,
               'stars',        x.stars
             ) ORDER BY x.display_name
           ) AS items
    FROM (
      SELECT
        s.id,
        public.student_display_name(s.nickname, s.full_name) AS display_name,
        s.avatar_emoji,
        coalesce((
          SELECT sum(e2.amount)::int
          FROM star_entries e2
          WHERE e2.student_id = s.id AND e2.amount > 0
        ), 0) AS stars
      FROM students s
      WHERE s.class_id = c.id
    ) x
  ) st ON TRUE
  WHERE c.id = v_class_id;

  RETURN v_result;
END;
$$;

-- 3.2. Персональна сторінка учня
CREATE OR REPLACE FUNCTION public.public_student_dashboard(p_code TEXT, p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_class_id UUID;
  v_stars    INT;
  v_result   JSONB;
BEGIN
  v_class_id := public.resolve_class_by_code(p_code);
  IF v_class_id IS NULL OR p_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Учень мусить належати саме цьому класу. Інакше — той самий NULL.
  IF NOT EXISTS (
    SELECT 1 FROM students s WHERE s.id = p_student_id AND s.class_id = v_class_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(e.amount)::int, 0)
  INTO v_stars
  FROM star_entries e
  WHERE e.student_id = p_student_id AND e.amount > 0;

  SELECT jsonb_build_object(
    'class_id',      c.id,
    'class_name',    c.name,
    'public_code',   c.public_code,
    'student', jsonb_build_object(
      'id',           s.id,
      'display_name', public.student_display_name(s.nickname, s.full_name),
      'avatar_emoji', s.avatar_emoji
    ),
    'total_stars',    v_stars,
    'rank', (
      SELECT count(*)::int + 1
      FROM (
        SELECT s2.id, coalesce((
          SELECT sum(e3.amount)::int FROM star_entries e3
          WHERE e3.student_id = s2.id AND e3.amount > 0
        ), 0) AS stars
        FROM students s2 WHERE s2.class_id = c.id
      ) peers
      WHERE peers.stars > v_stars
    ),
    'total_students', (SELECT greatest(count(*), 1)::int FROM students s3 WHERE s3.class_id = c.id),
    'prizes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',             p.id,
               'name',           p.name,
               'emoji',          p.emoji,
               'stars_required', p.stars_required,
               'sort_order',     p.sort_order
             ) ORDER BY p.sort_order)
      FROM prizes_individual p WHERE p.class_id = c.id
    ), '[]'::jsonb),
    'given_prize_ids', coalesce((
      SELECT jsonb_agg(g.prize_id)
      FROM prizes_given g WHERE g.student_id = s.id
    ), '[]'::jsonb),
    'history', coalesce((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC)
      FROM (
        SELECT e.amount, e.type::text AS type, e.note, e.created_at
        FROM star_entries e
        WHERE e.student_id = s.id
          AND NOT (e.type = 'lesson' AND e.amount = -1)
        ORDER BY e.created_at DESC
        LIMIT 30
      ) h
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.public_class_overview(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_student_dashboard(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_class_overview(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_student_dashboard(TEXT, UUID) TO anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Після застосування виконай, щоб побачити нові коди класів:
--
--   SELECT name,
--          substr(public_code,1,5) || '-' || substr(public_code,6,5) AS code,
--          legacy_code
--   FROM classes ORDER BY name;
--
-- Якщо колись захочеш погасити старі 4-значні посилання:
--   UPDATE classes SET legacy_code = NULL;
-- ---------------------------------------------------------------------------
