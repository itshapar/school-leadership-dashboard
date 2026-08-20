-- ============================================================================
-- 031_public_demo_teacher_view.sql
-- Публічний "вигляд вчителя" демо-класу (Етап 9, live-фідбек):
-- користувач хоче побачити в демо не лише публічний дашборд класу, а й
-- список учнів із розбивкою "хто скільки балів отримав і за що" — без PIN-
-- логіну (він у демо навмисно вимкнений, це не студентський флоу).
--
-- Функція НАВМИСНО жорстко прив'язана до is_public_demo = true в самому
-- тілі — це не загальний "дай мені історію будь-якого учня за кодом класу"
-- (саме таку діру закрила міграція 026 для public_student_dashboard).
-- Навіть якщо хтось підставить код реального класу, функція поверне NULL:
-- безпечно за конструкцією, а не лише за тим, що на неї не посилається UI.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.public_demo_teacher_view(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class_id UUID;
  v_result   JSONB;
BEGIN
  SELECT c.id INTO v_class_id
  FROM classes c
  WHERE c.public_code = public.normalize_class_code(p_code)
    AND c.is_public_demo = true
    AND c.deleted_at IS NULL;

  IF v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'class_id',    c.id,
    'name',        c.name,
    'public_code', c.public_code,
    'lessons', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'date', l.date) ORDER BY l.date)
      FROM lessons l
      WHERE l.class_id = c.id AND l.deleted_at IS NULL
    ), '[]'::jsonb),
    'students', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           x.id,
               'display_name', x.display_name,
               'avatar_emoji', x.avatar_emoji,
               'total_stars',  x.total_stars,
               'history',      x.history
             ) ORDER BY x.display_name)
      FROM (
        SELECT
          s.id,
          public.student_display_name(s.nickname, s.full_name) AS display_name,
          s.avatar_emoji,
          coalesce((SELECT sum(e.amount)::int FROM star_entries e
                    WHERE e.student_id = s.id AND e.amount > 0), 0) AS total_stars,
          coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                     'amount', e.amount,
                     'type_name', t.name,
                     'type_icon', t.icon,
                     'note', e.note,
                     'lesson_date', l.date,
                     'created_at', e.created_at
                   ) ORDER BY e.created_at DESC)
            FROM star_entries e
            LEFT JOIN entry_types t ON t.id = e.entry_type_id
            LEFT JOIN lessons l ON l.id = e.lesson_id
            WHERE e.student_id = s.id
          ), '[]'::jsonb) AS history
        FROM students s
        WHERE s.class_id = c.id AND s.deleted_at IS NULL
      ) x
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM classes c
  WHERE c.id = v_class_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.public_demo_teacher_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_demo_teacher_view(text) TO anon, authenticated;

COMMIT;
