-- ============================================================================
-- 027_rls_fix_and_public_demo.sql
-- Етап 9 · фікс RLS-діри на student_login_attempts/student_sessions
--         · колонка + RPC-поле для постійного публічного демо-класу
--
-- ЗНАЙДЕНО ПРИ АУДИТІ (2026-08-21): security advisor репортує
-- rls_enabled_no_policy на public.student_login_attempts і
-- public.student_sessions — RLS увімкнено, жодної policy немає.
--
-- Наслідок: `DELETE FROM classes WHERE ...` під роллю authenticated (як у
-- app/api/admin/demo/route.ts) каскадно намагається видалити рядки цих
-- таблиць через FK ON DELETE CASCADE. Без policy рядки, що каскадно
-- видаляються, невидимі для DELETE під RLS — операція мовчки не видаляє їх,
-- і сам батьківський DELETE може впертись у порушення FK. Для конкретного
-- демо-класу дітей там не було (тому саме цей кейс не відтворився), але
-- діра реальна для будь-якого класу з історією PIN-входів.
--
-- Даємо ЛИШЕ DELETE-policy, без SELECT: student_sessions.token_hash —
-- чутливе поле (хеш сесійного токена учня), пряме читання клієнтом
-- (навіть учителем-власником) через REST тут не потрібне і не бажане.
-- Увесь легітимний доступ до цих таблиць іде через SECURITY DEFINER RPC
-- (student_login/student_logout/student_dashboard_by_session), які
-- виконуються від імені власника таблиці й RLS не підпадають незалежно
-- від наявності policy тут.
-- ============================================================================

BEGIN;

CREATE POLICY student_login_attempts_delete_own ON public.student_login_attempts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = student_login_attempts.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY student_sessions_delete_own ON public.student_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = student_sessions.student_id AND c.teacher_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Публічне демо (Етап 9): постійний, завжди доступний без реєстрації клас,
-- на який веде /demo. На відміну від колишньої кнопки "Створити демо-клас"
-- (яка створювала демо в АКАУНТІ вчителя і видалялась разом з ним) — це один
-- спільний клас, видимий лише через уже публічний RPC public_class_overview.
-- ----------------------------------------------------------------------------

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_public_demo BOOLEAN NOT NULL DEFAULT false;

-- Максимум один публічний демо-клас одночасно — тег не для масового вжитку.
CREATE UNIQUE INDEX IF NOT EXISTS classes_one_public_demo
  ON public.classes ((is_public_demo))
  WHERE is_public_demo;

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
  IF v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'class_id',            c.id,
    'name',                c.name,
    'public_code',         c.public_code,
    'requested_legacy',    (c.public_code IS DISTINCT FROM v_norm),
    'is_public_demo',      coalesce(c.is_public_demo, false),
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

COMMIT;
