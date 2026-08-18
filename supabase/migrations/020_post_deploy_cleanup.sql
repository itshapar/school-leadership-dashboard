-- ============================================================================
-- 020_post_deploy_cleanup.sql
-- Етап 3 · Фаза B (CLEANUP) — ⚠️ НЕ ЗАСТОСОВУВАТИ РАЗОМ ІЗ 014–019! ⚠️
--
-- Застосовується ЛИШЕ ПІСЛЯ того, як:
--   1) міграції 014–019 застосовані на проді;
--   2) фронтенд, що працює з entry_types/class_prizes (і НЕ читає
--      star_entries.type, classes.*_threshold, class_prizes_given.prize_type,
--      а також старі ключі game_day_threshold/pizza_day_threshold у RPC),
--      задеплоєний і перевірений.
--
-- Порядок той самий, що в 013a→013b: спершу все працює паралельно,
-- потім одним файлом прибираємо легасі.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Тригери-містки перехідного періоду більше не потрібні.
-- ---------------------------------------------------------------------------
DROP TRIGGER  IF EXISTS star_entries_type_bridge_trg  ON public.star_entries;
DROP FUNCTION IF EXISTS public.star_entries_type_bridge();
DROP TRIGGER  IF EXISTS class_prizes_given_bridge_trg ON public.class_prizes_given;
DROP FUNCTION IF EXISTS public.class_prizes_given_bridge();
DROP TRIGGER  IF EXISTS legacy_thresholds_sync_trg    ON public.classes;
DROP FUNCTION IF EXISTS public.legacy_thresholds_sync();

-- Але: видача класового призу тепер МУСИТЬ вказувати приз.
ALTER TABLE public.class_prizes_given ALTER COLUMN class_prize_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. RPC без легасі (перевизначаємо ДО дропу стовпців).
--    public_class_overview: прибрано ключі game_day_threshold /
--    pizza_day_threshold (фронтенд читає class_prizes).
--    public_student_dashboard: історія фільтрується за is_lesson_bound
--    замість enum; ключ 'type' зникає, лишаються type_name/type_icon.
-- ---------------------------------------------------------------------------
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
      WHERE s.class_id = c.id AND s.deleted_at IS NULL
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
               t.name AS type_name,
               t.icon AS type_icon,
               e.note, e.created_at
        FROM star_entries e
        LEFT JOIN entry_types t ON t.id = e.entry_type_id
        WHERE e.student_id = s.id
          -- дрібні мінуси в межах уроку не показуємо (семантика 013a,
          -- виражена через властивість типу, а не enum)
          AND NOT (coalesce(t.is_lesson_bound, false) AND e.amount < 0)
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

-- ---------------------------------------------------------------------------
-- 3. Дроп легасі-стовпців та enum-типів.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.entry_types_legacy_uq;
ALTER TABLE public.entry_types        DROP COLUMN IF EXISTS legacy_type;
ALTER TABLE public.star_entries       DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS public.star_type;

DROP INDEX IF EXISTS public.class_prizes_legacy_uq;
ALTER TABLE public.class_prizes_given DROP COLUMN IF EXISTS prize_type;
ALTER TABLE public.class_prizes       DROP COLUMN IF EXISTS legacy_source;
DROP TYPE IF EXISTS public.class_prize_type;

ALTER TABLE public.classes
  DROP COLUMN IF EXISTS game_day_threshold,
  DROP COLUMN IF EXISTS pizza_day_threshold;

-- Свідомо ЗАЛИШЕНО:
--  • star_entries.student_id nullable — старий механізм «бонус усьому класу
--    одним рядком» (class_bonus у RPC); рішення про повний перехід на
--    fan-out — після Етапу 6 (онбординг/UI);
--  • students.full_name NOT NULL — якщо Етап 5 вирішить «ПІБ опціональне»,
--    достатньо: ALTER TABLE students ALTER COLUMN full_name DROP NOT NULL;
