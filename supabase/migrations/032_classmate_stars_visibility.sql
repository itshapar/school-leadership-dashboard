-- ============================================================================
-- 032_classmate_stars_visibility.sql
-- Live-фідбек Етапу 9.2: вчитель сам вирішує, чи бачать учні на публічному
-- дашборді класу (/class/[код], без PIN) кількість зірок ОДНОКЛАСНИКІВ, а не
-- лише сумарну кількість зірок усього класу.
--
-- Незалежно від цього прапорця: детальну історію "за що" бачить лише сам
-- учень через власний PIN (public_student_dashboard /
-- student_dashboard_by_session) — цього прапорець не стосується і не змінює.
-- ============================================================================

BEGIN;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS show_classmate_stars BOOLEAN NOT NULL DEFAULT false;

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
    'class_id',              c.id,
    'name',                  c.name,
    'public_code',           c.public_code,
    'requested_legacy',      (c.public_code IS DISTINCT FROM v_norm),
    'archived',              (c.archived_at IS NOT NULL),
    'is_public_demo',        coalesce(c.is_public_demo, false),
    'show_classmate_stars',  c.show_classmate_stars,
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
    SELECT jsonb_agg(
             CASE WHEN c.show_classmate_stars THEN
               jsonb_build_object(
                 'id', x.id, 'display_name', x.display_name,
                 'avatar_emoji', x.avatar_emoji, 'stars', x.stars
               )
             ELSE
               jsonb_build_object(
                 'id', x.id, 'display_name', x.display_name,
                 'avatar_emoji', x.avatar_emoji
               )
             END
             ORDER BY x.display_name) AS items
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
