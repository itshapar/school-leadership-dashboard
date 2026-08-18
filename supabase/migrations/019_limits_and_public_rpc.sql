-- ============================================================================
-- 019_limits_and_public_rpc.sql
-- Етап 3 · Фаза A (адитивна) · файл 6/6
--
-- 1) Анти-абуз ліміти з PRD — у БД (тригери), бо реєстрація відкрита і
--    застосунок можна обійти прямим зверненням до PostgREST. Застосунок
--    дублює перевірки для дружніх повідомлень; БД — останній рубіж.
--    CHECK-констрейнти не підходять: вони не вміють рахувати рядки.
-- 2) Перебудова RLS наявних 7 таблиць: замість однієї політики ALL — окремі
--    SELECT/INSERT/UPDATE/DELETE з WITH CHECK (семантика та сама, строго
--    teacher_id = auth.uid() напряму чи ланцюжком).
-- 3) Оновлені SECURITY DEFINER RPC: сумісні зі старим фронтендом (жодного
--    ключа не прибрано), + класові призи, + фільтр soft-deleted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1а. Ліміт на вчителя: ≤20 класів (PRD); ≤20 шкіл, ≤30 паралелей (дефолти
--     поза PRD, той самий механізм). Advisory-lock серіалізує конкурентні
--     INSERT-и одного вчителя.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_teacher_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_limit int := TG_ARGV[0]::int;
  v_count int;
BEGIN
  -- перевіряємо лише появу «живого» рядка: INSERT або undelete
  IF TG_OP = 'UPDATE' AND NOT (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME || ':' || NEW.teacher_id::text, 0));
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE teacher_id = $1 AND deleted_at IS NULL',
    TG_TABLE_NAME)
  INTO v_count USING NEW.teacher_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Досягнуто ліміт: не більше % (%) на один акаунт', v_limit, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_trg ON public.classes;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_limit('20');
DROP TRIGGER IF EXISTS limit_trg ON public.schools;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_limit('20');
DROP TRIGGER IF EXISTS limit_trg ON public.parallels;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.parallels
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_limit('30');

-- ---------------------------------------------------------------------------
-- 1б. Ліміти на клас: ≤60 учнів, ≤30 типів, ≤30 інд. призів, ≤30 класових
--     призів (PRD); ≤10 груп (дефолт поза PRD). Серіалізація — блокуванням
--     рядка класу.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_class_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_limit int := TG_ARGV[0]::int;
  v_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.classes WHERE id = NEW.class_id FOR UPDATE;
  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE class_id = $1 AND deleted_at IS NULL',
    TG_TABLE_NAME)
  INTO v_count USING NEW.class_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Досягнуто ліміт: не більше % (%) на один клас', v_limit, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_trg ON public.students;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit('60');
DROP TRIGGER IF EXISTS limit_trg ON public.entry_types;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.entry_types
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit('30');
DROP TRIGGER IF EXISTS limit_trg ON public.prizes_individual;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.prizes_individual
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit('30');
DROP TRIGGER IF EXISTS limit_trg ON public.class_prizes;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.class_prizes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit('30');
DROP TRIGGER IF EXISTS limit_trg ON public.class_groups;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit('10');

-- ---------------------------------------------------------------------------
-- 2. Перебудова RLS наявних таблиць: 4 політики замість ALL.
--    Deleted-рядки НЕ фільтруються в RLS: власник бачить свій «кошик»
--    (відновлення); публічна видача фільтрує їх у RPC.
-- ---------------------------------------------------------------------------

-- classes: власний teacher_id
DROP POLICY IF EXISTS teacher_owns_classes ON public.classes;
DROP POLICY IF EXISTS classes_select_own ON public.classes;
CREATE POLICY classes_select_own ON public.classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS classes_insert_own ON public.classes;
CREATE POLICY classes_insert_own ON public.classes FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS classes_update_own ON public.classes;
CREATE POLICY classes_update_own ON public.classes FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS classes_delete_own ON public.classes;
CREATE POLICY classes_delete_own ON public.classes FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- students / lessons / star_entries / prizes_individual / class_prizes_given:
-- ланцюжок через класи
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students', 'lessons', 'star_entries',
                           'prizes_individual', 'class_prizes_given']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS teacher_owns_%I ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select_own ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_select_own ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.classes c
                     WHERE c.id = %I.class_id AND c.teacher_id = auth.uid()))$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_own ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_insert_own ON public.%I FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                          WHERE c.id = %I.class_id AND c.teacher_id = auth.uid()))$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_own ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_update_own ON public.%I FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.classes c
                     WHERE c.id = %I.class_id AND c.teacher_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                          WHERE c.id = %I.class_id AND c.teacher_id = auth.uid()))$f$, t, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_own ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_delete_own ON public.%I FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.classes c
                     WHERE c.id = %I.class_id AND c.teacher_id = auth.uid()))$f$, t, t, t);
  END LOOP;
END $$;

-- prizes_given: ланцюжок через учня → клас
DROP POLICY IF EXISTS teacher_owns_prizes_given ON public.prizes_given;
DROP POLICY IF EXISTS prizes_given_select_own ON public.prizes_given;
CREATE POLICY prizes_given_select_own ON public.prizes_given FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.classes c ON c.id = s.class_id
                 WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS prizes_given_insert_own ON public.prizes_given;
CREATE POLICY prizes_given_insert_own ON public.prizes_given FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s JOIN public.classes c ON c.id = s.class_id
                      WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS prizes_given_update_own ON public.prizes_given;
CREATE POLICY prizes_given_update_own ON public.prizes_given FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.classes c ON c.id = s.class_id
                 WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s JOIN public.classes c ON c.id = s.class_id
                      WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS prizes_given_delete_own ON public.prizes_given;
CREATE POLICY prizes_given_delete_own ON public.prizes_given FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s JOIN public.classes c ON c.id = s.class_id
                 WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Оновлені публічні RPC (SECURITY DEFINER — модель Етапу 1).
--    Сумісність: усі старі ключі збережено; додано class_prizes і archived;
--    видалені (deleted_at) класи/учні/призи більше не віддаються.
--    full_name як і раніше НІКОЛИ не виходить назовні — тільки
--    student_display_name (nickname → друге слово ПІБ → «Учень»).
-- ---------------------------------------------------------------------------

-- видалений клас недоступний публічно; архівований — доступний (read-only)
CREATE OR REPLACE FUNCTION public.resolve_class_by_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT c.id
  FROM classes c
  WHERE public.normalize_class_code(p_code) <> ''
    AND c.deleted_at IS NULL
    AND (c.public_code = public.normalize_class_code(p_code)
      OR c.legacy_code = public.normalize_class_code(p_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.public_class_overview(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class_id UUID;
  v_norm     TEXT := public.normalize_class_code(p_code);
  v_result   JSONB;
BEGIN
  v_class_id := public.resolve_class_by_code(p_code);
  IF v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'class_id',         c.id,
    'name',             c.name,
    'public_code',      c.public_code,
    'requested_legacy', (c.public_code IS DISTINCT FROM v_norm),
    'archived',         (c.archived_at IS NOT NULL),
    -- старі ключі для задеплоєного фронтенду; джерело правди — class_prizes
    'game_day_threshold', coalesce(
      (SELECT p.threshold FROM class_prizes p
       WHERE p.class_id = c.id AND p.legacy_source = 'game_day' AND p.deleted_at IS NULL),
      c.game_day_threshold),
    'pizza_day_threshold', coalesce(
      (SELECT p.threshold FROM class_prizes p
       WHERE p.class_id = c.id AND p.legacy_source = 'pizza_day' AND p.deleted_at IS NULL),
      c.pizza_day_threshold),
    -- нова конфігурована видача класових призів
    'class_prizes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'emoji', p.emoji,
               'threshold', p.threshold, 'sort_order', p.sort_order,
               'given_count', (SELECT count(*)::int FROM class_prizes_given g
                               WHERE g.class_prize_id = p.id)
             ) ORDER BY p.sort_order)
      FROM class_prizes p
      WHERE p.class_id = c.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'personal_stars', coalesce(agg.personal_stars, 0),
    'class_bonus',    coalesce(agg.class_bonus, 0),
    'total_stars',    coalesce(agg.personal_stars, 0) + coalesce(agg.class_bonus, 0),
    'class_entries',  coalesce(ce.items, '[]'::jsonb),
    'students',       coalesce(st.items, '[]'::jsonb)
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
    SELECT jsonb_agg(jsonb_build_object(
             'amount', e.amount, 'note', e.note, 'created_at', e.created_at
           ) ORDER BY e.created_at DESC) AS items
    FROM star_entries e
    WHERE e.class_id = c.id AND e.student_id IS NULL
  ) ce ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id, 'display_name', x.display_name,
             'avatar_emoji', x.avatar_emoji, 'stars', x.stars
           ) ORDER BY x.display_name) AS items
    FROM (
      SELECT
        s.id,
        public.student_display_name(s.nickname, s.full_name) AS display_name,
        s.avatar_emoji,
        coalesce((SELECT sum(e2.amount)::int FROM star_entries e2
                  WHERE e2.student_id = s.id AND e2.amount > 0), 0) AS stars
      FROM students s
      WHERE s.class_id = c.id AND s.deleted_at IS NULL     -- soft-deleted не видаємо
    ) x
  ) st ON TRUE
  WHERE c.id = v_class_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_student_dashboard(p_code text, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student_id AND s.class_id = v_class_id AND s.deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(e.amount)::int, 0)
  INTO v_stars
  FROM star_entries e
  WHERE e.student_id = p_student_id AND e.amount > 0;

  SELECT jsonb_build_object(
    'class_id',    c.id,
    'class_name',  c.name,
    'public_code', c.public_code,
    'archived',    (c.archived_at IS NOT NULL),
    'student', jsonb_build_object(
      'id',           s.id,
      'display_name', public.student_display_name(s.nickname, s.full_name),
      'avatar_emoji', s.avatar_emoji
    ),
    'total_stars', v_stars,
    'rank', (
      SELECT count(*)::int + 1
      FROM (
        SELECT s2.id, coalesce((SELECT sum(e3.amount)::int FROM star_entries e3
                                WHERE e3.student_id = s2.id AND e3.amount > 0), 0) AS stars
        FROM students s2
        WHERE s2.class_id = c.id AND s2.deleted_at IS NULL
      ) peers
      WHERE peers.stars > v_stars
    ),
    'total_students', (SELECT greatest(count(*), 1)::int FROM students s3
                       WHERE s3.class_id = c.id AND s3.deleted_at IS NULL),
    'prizes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'emoji', p.emoji,
               'stars_required', p.stars_required, 'sort_order', p.sort_order
             ) ORDER BY p.sort_order)
      FROM prizes_individual p
      WHERE p.class_id = c.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'given_prize_ids', coalesce((
      SELECT jsonb_agg(g.prize_id) FROM prizes_given g WHERE g.student_id = s.id
    ), '[]'::jsonb),
    'history', coalesce((
      SELECT jsonb_agg(h ORDER BY h.created_at DESC)
      FROM (
        SELECT e.amount,
               e.type::text AS type,          -- сумісність зі старим фронтендом (до 020)
               t.name       AS type_name,     -- нове: назва типу нарахування
               t.icon       AS type_icon,
               e.note, e.created_at
        FROM star_entries e
        LEFT JOIN entry_types t ON t.id = e.entry_type_id
        WHERE e.student_id = s.id
          AND NOT (e.type = 'lesson' AND e.amount = -1)   -- як в 013a; у 020 → is_lesson_bound
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

-- Гранти явно (CREATE OR REPLACE зберігає ACL, але фіксуємо детерміновано):
-- це ЄДИНИЙ шлях anon до даних.
GRANT EXECUTE ON FUNCTION public.resolve_class_by_code(text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_class_overview(text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_student_dashboard(text, uuid)     TO anon, authenticated;
