-- ============================================================================
-- 028_fix_public_class_overview_regression.sql
-- Виправлення регресії, внесеної 027.
--
-- 027 переписав public_class_overview зі СТАРОЮ версією тіла функції (з
-- 013a), тоді як фактично чинна версія була визначена пізніше в
-- 020_post_deploy_cleanup.sql (легасі game_day_threshold/pizza_day_threshold
-- прибрано, додано archived + class_prizes на базі class_prizes/threshold,
-- і фільтр s.deleted_at IS NULL на учнях). 027 через це відкотив API назад
-- до легасі-полів і загубив archived/class_prizes/deleted_at-фільтр.
--
-- Ця міграція бере ЧИННЕ (з 020) тіло функції один-в-один і додає лише
-- 'is_public_demo' — рівно те, що й мало бути зроблено в 027.
-- ============================================================================

BEGIN;

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
    'is_public_demo',   coalesce(c.is_public_demo, false),
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

COMMIT;
