-- ============================================================================
-- 018_pin_softdelete_audit.sql
-- Етап 3 · Фаза A (адитивна) · файл 5/6
--
-- 1) PIN-доступ учнів (лише схема + скидання вчителем; механіка сесій —
--    Етап 4, схема її передбачає через pin_generation).
-- 2) Soft delete робочих сутностей + архівація класу (read-only).
-- 3) Audit log (мінімум: star_entries) — append-only.
-- 4) Процедури НЕЗВОРОТНОГО видалення: учень (запит батьків) і всі дані
--    вчителя (право на забуття).
--
-- Грабля з 013a врахована: pgcrypto живе у схемі extensions → всі функції,
-- що хешують/генерують випадкове, мають 'extensions' у search_path.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PIN учня. Зберігається ЛИШЕ bcrypt-хеш. pin_generation інкрементується
--    при кожному скиданні — Етап 4 дешево інвалідовує старі сесії, порівнюючи
--    generation у токені з поточним.
-- ---------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin_hash       text,
  ADD COLUMN IF NOT EXISTS pin_set_at     timestamptz,
  ADD COLUMN IF NOT EXISTS pin_generation int NOT NULL DEFAULT 0;

-- Скидання/генерація PIN вчителем. SECURITY INVOKER: UPDATE проходить RLS,
-- чужого учня не зачепиш (0 рядків → помилка). Повертає PIN відкритим текстом
-- РІВНО ОДИН РАЗ — вчитель бачить його в UI і роздає учню.
CREATE OR REPLACE FUNCTION public.reset_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_num int;
  v_pin text;
  v_rows int;
BEGIN
  v_num := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int;
  v_pin := lpad(((v_num & 2147483647) % 1000000)::text, 6, '0');

  UPDATE public.students
  SET pin_hash       = extensions.crypt(v_pin, extensions.gen_salt('bf')),
      pin_set_at     = now(),
      pin_generation = pin_generation + 1
  WHERE id = p_student_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Учня не знайдено або немає доступу';
  END IF;
  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_student_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_pin(uuid) TO authenticated;
-- Перевірка PIN (verify) — SECURITY DEFINER RPC Етапу 4, тут не проєктується.

-- ---------------------------------------------------------------------------
-- 2. Soft delete + архівація.
--    star_entries і prizes_given БЕЗ deleted_at: їх видалення — фізичне,
--    слід лишається в audit_log (для star_entries), а «кошик» для журналу
--    зробив би кожну агрегацію умовною.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,   -- read-only клас
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
ALTER TABLE public.students          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.lessons           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.prizes_individual ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- (schools, parallels, class_groups, entry_types, class_prizes мають
--  deleted_at з моменту створення у 014–016.)

-- Guard: заборона запису в дочірні таблиці архівованого/видаленого класу.
-- Реалізовано ТРИГЕРАМИ, а не ускладненням RLS: політики лишаються чистою
-- «ізоляційною» логікою, а помилка — зрозумілою. Службовий байпас через
-- транзакційно-локальний GUC вмикають ЛИШЕ процедури незворотного видалення.
CREATE OR REPLACE FUNCTION public.assert_class_writable(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_archived timestamptz;
  v_deleted  timestamptz;
BEGIN
  IF coalesce(current_setting('app.bypass_archive_guard', true), '') = 'on' THEN
    RETURN;
  END IF;
  SELECT c.archived_at, c.deleted_at INTO v_archived, v_deleted
  FROM public.classes c WHERE c.id = p_class_id;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Клас видалено';
  END IF;
  IF v_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Клас архівовано — доступний лише перегляд';
  END IF;
END;
$$;

-- Загальний guard для таблиць із class_id.
CREATE OR REPLACE FUNCTION public.class_child_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.assert_class_writable(coalesce(NEW.class_id, OLD.class_id));
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS archive_guard_trg ON public.lessons;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.star_entries;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.star_entries
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.entry_types;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.entry_types
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.prizes_individual;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.prizes_individual
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.class_prizes;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.class_prizes
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.class_prizes_given;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.class_prizes_given
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();
DROP TRIGGER IF EXISTS archive_guard_trg ON public.class_groups;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.class_child_write_guard();

-- students: те саме, АЛЕ зміна лише pin_* дозволена і в архівованому класі
-- (учень забув PIN — вчитель мусить мати змогу скинути навіть після архівації).
CREATE OR REPLACE FUNCTION public.students_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND to_jsonb(NEW) - 'pin_hash' - 'pin_set_at' - 'pin_generation'
       = to_jsonb(OLD) - 'pin_hash' - 'pin_set_at' - 'pin_generation' THEN
    RETURN NEW;   -- зміна лише PIN-полів
  END IF;
  PERFORM public.assert_class_writable(coalesce(NEW.class_id, OLD.class_id));
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS archive_guard_trg ON public.students;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_write_guard();

-- prizes_given: class_id визначається через учня.
CREATE OR REPLACE FUNCTION public.prizes_given_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class uuid;
BEGIN
  SELECT s.class_id INTO v_class
  FROM public.students s WHERE s.id = coalesce(NEW.student_id, OLD.student_id);
  IF v_class IS NOT NULL THEN
    PERFORM public.assert_class_writable(v_class);
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS archive_guard_trg ON public.prizes_given;
CREATE TRIGGER archive_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON public.prizes_given
  FOR EACH ROW EXECUTE FUNCTION public.prizes_given_write_guard();

-- ---------------------------------------------------------------------------
-- 3. Audit log: хто, коли, що змінив. Append-only:
--    • INSERT — лише SECURITY DEFINER тригер-функція (грантів на запис немає);
--    • SELECT — вчитель бачить лише свій audit (RLS);
--    • UPDATE/DELETE — ні для кого через API (політик немає); чистять лише
--      процедури незворотного видалення (SECURITY DEFINER).
--    Без FK — записи аудиту переживають видалення рядків, які описують.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      uuid,                 -- auth.uid() на момент дії (NULL = system)
  teacher_id uuid NOT NULL,        -- власник даних → база RLS
  class_id   uuid,
  table_name text NOT NULL,
  row_id     uuid,
  action     text NOT NULL CHECK (action IN
               ('INSERT', 'UPDATE', 'DELETE', 'HARD_DELETE_STUDENT', 'HARD_DELETE_TEACHER')),
  old_data   jsonb,
  new_data   jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_teacher_at_idx ON public.audit_log (teacher_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_row_idx        ON public.audit_log (row_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

DROP POLICY IF EXISTS audit_log_select_own ON public.audit_log;
CREATE POLICY audit_log_select_own ON public.audit_log FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
-- INSERT/UPDATE/DELETE політик свідомо НЕМАЄ.

-- Тригер-функція: SECURITY DEFINER, бо в authenticated немає INSERT-грантів
-- на audit_log — це і робить журнал захищеним від прямого запису.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_class   uuid := coalesce(NEW.class_id, OLD.class_id);
  v_teacher uuid;
BEGIN
  SELECT c.teacher_id INTO v_teacher FROM public.classes c WHERE c.id = v_class;
  INSERT INTO public.audit_log
    (actor, teacher_id, class_id, table_name, row_id, action, old_data, new_data)
  VALUES (
    auth.uid(), v_teacher, v_class, TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id), TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

-- Мінімум за PRD: star_entries. Розширення на інші таблиці = ще один
-- CREATE TRIGGER (та сама функція придатна для будь-якої таблиці з class_id).
DROP TRIGGER IF EXISTS audit_trg ON public.star_entries;
CREATE TRIGGER audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.star_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 4. Незворотне видалення.
-- ---------------------------------------------------------------------------

-- 4.1 Учень (запит батьків): фізично стираються всі його записи + сліди в
-- audit_log (old/new_data містять його дані). Лишається знеособлений
-- tombstone HARD_DELETE_STUDENT — доказ виконання запиту без персональних даних.
CREATE OR REPLACE FUNCTION public.hard_delete_student(p_student_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_class   uuid;
  v_teacher uuid;
BEGIN
  SELECT s.class_id, c.teacher_id INTO v_class, v_teacher
  FROM public.students s JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = p_student_id;

  IF v_teacher IS NULL OR v_teacher <> auth.uid() THEN
    RAISE EXCEPTION 'Учня не знайдено або немає доступу';
  END IF;

  -- дозволити операцію і в архівованому класі (лише в цій транзакції)
  PERFORM set_config('app.bypass_archive_guard', 'on', true);

  DELETE FROM public.prizes_given WHERE student_id = p_student_id;
  DELETE FROM public.star_entries WHERE student_id = p_student_id;
  DELETE FROM public.students     WHERE id = p_student_id;

  -- зачистка слідів у журналі аудиту (включно зі щойно створеними DELETE-рядками)
  DELETE FROM public.audit_log
  WHERE old_data->>'student_id' = p_student_id::text
     OR new_data->>'student_id' = p_student_id::text
     OR (table_name = 'students' AND row_id = p_student_id);

  INSERT INTO public.audit_log (actor, teacher_id, class_id, table_name, row_id, action)
  VALUES (auth.uid(), v_teacher, v_class, 'students', p_student_id, 'HARD_DELETE_STUDENT');
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hard_delete_student(uuid) TO authenticated;

-- 4.2 Всі дані вчителя (право на забуття). Стирає ВСЕ в public-схемі для
-- auth.uid(). Сам рядок auth.users видаляється окремо через Supabase Admin
-- API (service-role, server-side) — з SQL це не робиться.
CREATE OR REPLACE FUNCTION public.hard_delete_teacher_account()
RETURNS void
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Немає автентифікації';
  END IF;

  PERFORM set_config('app.bypass_archive_guard', 'on', true);

  -- classes → CASCADE: students, lessons, star_entries, prizes_individual,
  -- prizes_given, class_prizes_given, entry_types, class_prizes, class_groups
  DELETE FROM public.classes          WHERE teacher_id = v_uid;
  DELETE FROM public.parallels        WHERE teacher_id = v_uid;
  DELETE FROM public.schools          WHERE teacher_id = v_uid;
  DELETE FROM public.config_templates WHERE teacher_id = v_uid;
  -- audit_log — ОСТАННІМ: каскадні DELETE вище щойно дописали в нього рядки
  -- через audit-тригери; чистимо все разом.
  DELETE FROM public.audit_log WHERE teacher_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_teacher_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hard_delete_teacher_account() TO authenticated;
