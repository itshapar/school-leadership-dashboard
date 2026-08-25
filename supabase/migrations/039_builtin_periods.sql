-- ============================================================================
-- 039_builtin_periods.sql
-- Етап 10.2 · Семестри стають ВБУДОВАНИМ КАЛЕНДАРЕМ, а не сутністю, яку
-- вчитель заводить руками.
--
-- Міграція 038 дала вчителю таблицю semesters із назвами й довільними датами.
-- Живий фідбек (Andrew): «Я не хочу давати вчителям можливість створювати
-- самі семестри. Це складна система, вона може працювати значно простіше».
-- І це правда: семестр у школі не налаштовується, він настає. Тримати під це
-- таблицю з RLS, лімітом, унікальністю назв і екраном керування означало
-- продавати вчителю роботу, якої в нього нема.
--
-- Тепер період — це просто КОД: '2026-1' (I семестр 2026/2027), '2026-2'
-- (II семестр). Чотири цифри навчального року плюс номер семестру. Ніяких
-- рядків, ніякого RLS, ніякої синхронізації між учителями: календар
-- однаковий для всіх, бо він і в житті однаковий.
--
-- Межі (рішення Andrew): навчальний рік триває з 1 СЕРПНЯ по 31 липня.
--   I семестр  — 1 серпня Y     … 31 грудня Y
--   II семестр — 1 січня Y+1    … 31 липня Y+1
-- Серпень свідомо всередині I семестру, а не в «порожнечі» між роками: саме
-- в серпні вчитель заводить класи на новий рік, і якби період відкривався
-- 1 вересня, підготуватись було б ніде.
--
-- Період не можна обрати наперед: він відкривається, коли настає (перевірка
-- нижче в roll_over_class, і вона ж — правило продукту, а не UI-умовність).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Дві чисті функції календаря. Одне джерело правди для БД і для
--    lib/admin/periods.ts, який рахує те саме на клієнті.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.period_start(p_code text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_code !~ '^20\d{2}-[12]$' THEN NULL
    WHEN right(p_code, 1) = '1' THEN make_date(left(p_code, 4)::int, 8, 1)
    ELSE make_date(left(p_code, 4)::int + 1, 1, 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.period_of(p_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN extract(month from p_date) >= 8
      THEN extract(year from p_date)::int::text || '-1'
    ELSE (extract(year from p_date)::int - 1)::text || '-2'
  END;
$$;

REVOKE ALL ON FUNCTION public.period_start(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.period_of(date)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.period_start(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.period_of(date)   TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Клас тримає код періоду замість посилання на рядок семестру.
--
--    Бекфіл — за датою створення класу, це найчесніше наближення: клас, який
--    завели в березні 2026, справді жив у II семестрі 2025/2026, а той, що
--    завели в серпні 2026, уже в I семестрі 2026/2027. Час київський: біля
--    межі 1 серпня різниця з UTC вирішує, у який семестр потрапить клас.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS period_code text;

UPDATE public.classes
SET period_code = public.period_of((created_at AT TIME ZONE 'Europe/Kyiv')::date)
WHERE period_code IS NULL;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_period_code_ck;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_period_code_ck CHECK (period_code ~ '^20\d{2}-[12]$');

-- Дефолт = поточний період: клас, створений без явного коду (скрипти, сіди),
-- потрапляє туди, де вчитель працює зараз, а не в NULL-порожнечу.
ALTER TABLE public.classes ALTER COLUMN period_code SET DEFAULT public.period_of(current_date);
ALTER TABLE public.classes ALTER COLUMN period_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS classes_period_idx ON public.classes (teacher_id, period_code);

-- ---------------------------------------------------------------------------
-- 3. Таблиця semesters більше не потрібна: жодного поля, якого не можна
--    вирахувати з коду періоду. Разом із нею йдуть її RLS-політики, ліміт і
--    композитний FK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_semester_same_teacher_fk;
ALTER TABLE public.classes DROP COLUMN IF EXISTS semester_id;
DROP TABLE IF EXISTS public.semesters;

-- ---------------------------------------------------------------------------
-- 4. Перехід класу в наступний період. Та сама транзакція, що в 038, але
--    ціль тепер код, а не рядок семестру, і додались два правила, які раніше
--    тримав тільки інтерфейс:
--      • у майбутній період перенести не можна (він ще не настав);
--      • переносити можна лише ВПЕРЕД (коди впорядковані лексикографічно:
--        '2025-1' < '2025-2' < '2026-1').
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.roll_over_class(uuid, uuid, text, uuid, uuid[], boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.roll_over_class(
  p_source_class_id uuid,
  p_period_code     text,
  p_name            text,
  p_parallel_id     uuid    DEFAULT NULL,   -- NULL → та сама паралель
  p_student_ids     uuid[]  DEFAULT NULL,   -- NULL → усі живі учні
  p_copy_pins       boolean DEFAULT true,
  p_copy_config     boolean DEFAULT true,
  p_move_code       boolean DEFAULT true,
  p_archive_source  boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_src      public.classes%ROWTYPE;
  v_new_id   uuid;
  v_old_code text;
  v_name     text := btrim(p_name);
BEGIN
  IF v_name = '' OR length(v_name) > 60 THEN
    RAISE EXCEPTION 'Назва класу порожня або задовга';
  END IF;

  IF p_period_code !~ '^20\d{2}-[12]$' THEN
    RAISE EXCEPTION 'Невідомий період';
  END IF;
  IF public.period_start(p_period_code) > current_date THEN
    RAISE EXCEPTION 'Цей семестр ще не почався';
  END IF;

  SELECT * INTO v_src FROM public.classes
  WHERE id = p_source_class_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Клас не знайдено або немає доступу';
  END IF;
  IF v_src.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Клас уже в архіві: перенести його вдруге не можна';
  END IF;
  IF v_src.is_public_demo THEN
    RAISE EXCEPTION 'Публічний демо-клас не переноситься';
  END IF;
  IF p_period_code <= v_src.period_code THEN
    RAISE EXCEPTION 'Переносити клас можна лише в наступний семестр';
  END IF;

  INSERT INTO public.classes
    (name, teacher_id, parallel_id, period_code, lessons_per_week,
     show_classmate_stars, rolled_from_class_id)
  VALUES
    (v_name, v_src.teacher_id, coalesce(p_parallel_id, v_src.parallel_id),
     p_period_code, v_src.lessons_per_week, v_src.show_classmate_stars, v_src.id)
  RETURNING id INTO v_new_id;

  IF p_copy_config THEN
    INSERT INTO public.entry_types
      (class_id, name, sign, default_amount, is_lesson_bound, icon, color, sort_order, legacy_type)
    SELECT v_new_id, e.name, e.sign, e.default_amount, e.is_lesson_bound,
           e.icon, e.color, e.sort_order, e.legacy_type
    FROM public.entry_types e
    WHERE e.class_id = v_src.id AND e.deleted_at IS NULL;

    INSERT INTO public.prizes_individual (class_id, name, stars_required, emoji, sort_order)
    SELECT v_new_id, p.name, p.stars_required, p.emoji, p.sort_order
    FROM public.prizes_individual p
    WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

    INSERT INTO public.class_prizes (class_id, name, emoji, threshold, sort_order)
    SELECT v_new_id, p.name, p.emoji, p.threshold, p.sort_order
    FROM public.class_prizes p
    WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

    INSERT INTO public.class_groups (class_id, name, sort_order)
    SELECT v_new_id, g.name, g.sort_order
    FROM public.class_groups g
    WHERE g.class_id = v_src.id AND g.deleted_at IS NULL;
  ELSE
    PERFORM public.apply_class_template(v_new_id, NULL);
  END IF;

  -- Учні. Групи мапляться за назвою: class_groups_name_uq гарантує, що
  -- всередині класу назва унікальна, тож збігу «не тієї» групи бути не може.
  INSERT INTO public.students
    (class_id, full_name, nickname, avatar_emoji, group_id, rolled_from_student_id,
     pin_hash, pin_encrypted, pin_set_at)
  SELECT v_new_id, s.full_name, s.nickname, s.avatar_emoji, ng.id, s.id,
         CASE WHEN p_copy_pins THEN s.pin_hash      END,
         CASE WHEN p_copy_pins THEN s.pin_encrypted END,
         CASE WHEN p_copy_pins THEN s.pin_set_at    END
  FROM public.students s
  LEFT JOIN public.class_groups og ON og.id = s.group_id
  LEFT JOIN public.class_groups ng
         ON ng.class_id = v_new_id AND lower(ng.name) = lower(og.name)
  WHERE s.class_id = v_src.id
    AND s.deleted_at IS NULL
    AND (p_student_ids IS NULL OR s.id = ANY (p_student_ids))
  ORDER BY s.created_at;

  -- Код класу переїжджає на новий клас: для дітей не змінюється нічого, той
  -- самий код, той самий PIN. Архів отримує свіжий код, бо його відкриває
  -- лише вчитель. Спочатку звільняємо код, потім забираємо, інакше впаде
  -- унікальний індекс classes_public_code_key.
  IF p_move_code THEN
    v_old_code := v_src.public_code;
    UPDATE public.classes SET public_code = public.generate_class_public_code()
    WHERE id = v_src.id;
    UPDATE public.classes SET public_code = v_old_code WHERE id = v_new_id;
  END IF;

  -- Живі сесії учнів старого класу треба обірвати: інакше дитина ще 400 днів
  -- дивилась би торішній дашборд замість нового семестру. pin_generation —
  -- штатний механізм відкликання сесій (022), сам PIN від цього не міняється.
  IF p_move_code OR p_archive_source THEN
    UPDATE public.students SET pin_generation = pin_generation + 1
    WHERE class_id = v_src.id AND deleted_at IS NULL;
  END IF;

  IF p_archive_source THEN
    UPDATE public.classes SET archived_at = now() WHERE id = v_src.id;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_over_class(uuid, text, text, uuid, uuid[], boolean, boolean, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roll_over_class(uuid, text, text, uuid, uuid[], boolean, boolean, boolean, boolean)
  TO authenticated;

COMMIT;
