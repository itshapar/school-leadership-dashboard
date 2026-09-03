-- ============================================================================
-- 045_student_dashboard_rank_and_lesson_dates.sql
-- Два баги персонального дашборда учня, знайдені при перегляді туторіалу
-- (живий фідбек):
--
-- 1. РАНГ ПРИ ВИМКНЕНОМУ КОНКУРЕНТНОМУ СЕРЕДОВИЩІ. Прапорець
--    classes.show_classmate_stars (міграція 032) вимикає показ зірок
--    однокласників у списку класу, але `rank` і `total_students` цей RPC
--    віддавав завжди. Учень заходив у свій профіль і бачив «#4» — тобто
--    рівно ту інформацію про порівняння з однокласниками, яку вчитель
--    свідомо вимкнув. Тепер обидва поля NULL, поки прапорець вимкнений:
--    ховати їх лише в інтерфейсі мало, бо ранг однаково їхав би на клієнт
--    у payload сторінки.
--
-- 2. ДАТА В ІСТОРІЇ ЗІРОК. Запис за урок показувався датою `created_at` —
--    тобто коли вчитель проставив зірки в журналі, а не коли урок був.
--    Вчитель, який в один вечір заповнив уроки за 02.09, 07.09 і 09.09,
--    бачив в учня три записи однією сьогоднішньою датою. Тепер запис,
--    прив'язаний до уроку, віддає ще й `occurred_on` — дату САМОГО УРОКУ,
--    і історія сортується за нею. Бонуси й штрафи до уроку не прив'язані:
--    у них `occurred_on` порожній, і показуються вони, як і раніше, за
--    фактичною датою нарахування.
--
-- `created_at` лишається в payload: він і далі потрібен бонусам/штрафам і
-- нічого не ламає в клієнтах, які нового поля ще не знають.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.public_student_dashboard(p_code text, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class_id UUID;
  v_stars    INT;
  v_show     BOOLEAN;
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

  SELECT c.show_classmate_stars INTO v_show FROM classes c WHERE c.id = v_class_id;

  SELECT coalesce(sum(e.amount)::int, 0)
  INTO v_stars
  FROM star_entries e
  WHERE e.student_id = p_student_id AND e.amount > 0;

  SELECT jsonb_build_object(
    'class_id',    c.id,
    'class_name',  c.name,
    'public_code', c.public_code,
    'archived',    (c.archived_at IS NOT NULL),
    'show_classmate_stars', v_show,
    'student', jsonb_build_object(
      'id',           s.id,
      'display_name', public.student_display_name(s.nickname, s.full_name),
      'avatar_emoji', s.avatar_emoji
    ),
    'total_stars', v_stars,
    -- Ранг і розмір класу — тільки при увімкненому конкурентному середовищі.
    'rank', CASE WHEN v_show THEN (
      SELECT count(*)::int + 1
      FROM (
        SELECT s2.id, coalesce((SELECT sum(e3.amount)::int FROM star_entries e3
                                WHERE e3.student_id = s2.id AND e3.amount > 0), 0) AS stars
        FROM students s2
        WHERE s2.class_id = c.id AND s2.deleted_at IS NULL
      ) peers
      WHERE peers.stars > v_stars
    ) END,
    'total_students', CASE WHEN v_show THEN
      (SELECT greatest(count(*), 1)::int FROM students s3
       WHERE s3.class_id = c.id AND s3.deleted_at IS NULL)
    END,
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
      SELECT jsonb_agg(jsonb_build_object(
               'amount',      h.amount,
               'type',        h.type,
               'type_name',   h.type_name,
               'type_icon',   h.type_icon,
               'note',        h.note,
               'created_at',  h.created_at,
               'occurred_on', h.occurred_on
             ) ORDER BY h.sort_at DESC)
      FROM (
        SELECT e.amount,
               e.type::text AS type,
               t.name       AS type_name,
               t.icon       AS type_icon,
               e.note, e.created_at,
               -- Урок без фільтра deleted_at навмисно: якщо урок згодом
               -- прибрали, дата, коли він БУВ, від цього не змінилась.
               l.date       AS occurred_on,
               coalesce(l.date::timestamptz, e.created_at) AS sort_at
        FROM star_entries e
        LEFT JOIN entry_types t ON t.id = e.entry_type_id
        LEFT JOIN lessons     l ON l.id = e.lesson_id
        WHERE e.student_id = s.id
          AND NOT (e.type = 'lesson' AND e.amount = -1)
        ORDER BY coalesce(l.date::timestamptz, e.created_at) DESC
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

-- ACL не чіпаємо: після 035 функція відкликана в anon/authenticated і
-- викликається лише зсередини student_dashboard_by_session (SECURITY DEFINER).

COMMIT;
