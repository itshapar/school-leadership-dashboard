-- ============================================================================
-- 047_demo_backfill_and_no_weekly.sql
-- Повернути історію демо і прибрати графік активності по тижнях.
--
-- Журнал demo_session_log (міграція 046) почав писати 5 вересня 2026 об
-- 11:18 UTC, і все, що було до того, виглядало як нуль. Виявилось, що слід
-- усе-таки лишався, просто не в базі: у логах авторизації Supabase кожен
-- гість демо видно як вхід із login_method=anonymous.
--
-- Звірка, чому цим числам можна вірити: за 5 вересня до 11:18 у логах 16
-- анонімних входів, і рівно стільки ж анонімних користувачів було в
-- auth.users на той момент (15 живих плюс той, що створив перший рядок
-- журналу). Тобто один вхід, це один гість, а не одне натискання.
--
-- Відновлено 121 запуск за 31.08 - 05.09. Раніше 31 серпня демо ще не
-- існувало (пісочниця з'явилась міграцією 040 першого вересня), тож нулі до
-- тієї дати, це справжні нулі, а не втрачені дані.
--
-- Точний час усередині години логи дають, але зберігати його немає сенсу:
-- рядки розкладені рівномірно в межах своєї години. Колонка backfilled
-- чесно позначає, які рядки прийшли з логів, а не від тригера.
--
-- Заодно з віддачі прибрано 'weekly': графік активності по тижнях на такому
-- масштабі показував два з половиною стовпчики і місця на сторінці не
-- виправдовував.
-- ============================================================================

BEGIN;

ALTER TABLE public.demo_session_log
  ADD COLUMN IF NOT EXISTS backfilled boolean NOT NULL DEFAULT false;

-- Ідемпотентність: повторне застосування нічого не подвоїть.
INSERT INTO public.demo_session_log (started_at, backfilled)
SELECT h + ((i - 0.5) * 60.0 / n) * interval '1 minute', true
FROM (VALUES
  (timestamptz '2026-08-31 15:00:00+00', 1),
  (timestamptz '2026-08-31 18:00:00+00', 1),
  (timestamptz '2026-09-01 02:00:00+00', 2),
  (timestamptz '2026-09-01 14:00:00+00', 1),
  (timestamptz '2026-09-01 15:00:00+00', 2),
  (timestamptz '2026-09-01 17:00:00+00', 1),
  (timestamptz '2026-09-01 18:00:00+00', 1),
  (timestamptz '2026-09-01 20:00:00+00', 1),
  (timestamptz '2026-09-02 09:00:00+00', 1),
  (timestamptz '2026-09-02 10:00:00+00', 3),
  (timestamptz '2026-09-02 11:00:00+00', 1),
  (timestamptz '2026-09-02 12:00:00+00', 1),
  (timestamptz '2026-09-02 13:00:00+00', 1),
  (timestamptz '2026-09-02 14:00:00+00', 2),
  (timestamptz '2026-09-02 15:00:00+00', 1),
  (timestamptz '2026-09-02 20:00:00+00', 1),
  (timestamptz '2026-09-02 22:00:00+00', 1),
  (timestamptz '2026-09-03 07:00:00+00', 3),
  (timestamptz '2026-09-03 08:00:00+00', 2),
  (timestamptz '2026-09-03 09:00:00+00', 2),
  (timestamptz '2026-09-03 10:00:00+00', 5),
  (timestamptz '2026-09-03 11:00:00+00', 2),
  (timestamptz '2026-09-03 12:00:00+00', 3),
  (timestamptz '2026-09-03 13:00:00+00', 4),
  (timestamptz '2026-09-03 14:00:00+00', 4),
  (timestamptz '2026-09-03 15:00:00+00', 11),
  (timestamptz '2026-09-03 16:00:00+00', 5),
  (timestamptz '2026-09-03 17:00:00+00', 2),
  (timestamptz '2026-09-03 18:00:00+00', 1),
  (timestamptz '2026-09-03 19:00:00+00', 1),
  (timestamptz '2026-09-03 20:00:00+00', 2),
  (timestamptz '2026-09-04 06:00:00+00', 1),
  (timestamptz '2026-09-04 08:00:00+00', 1),
  (timestamptz '2026-09-04 09:00:00+00', 3),
  (timestamptz '2026-09-04 10:00:00+00', 1),
  (timestamptz '2026-09-04 11:00:00+00', 4),
  (timestamptz '2026-09-04 12:00:00+00', 3),
  (timestamptz '2026-09-04 13:00:00+00', 2),
  (timestamptz '2026-09-04 14:00:00+00', 3),
  (timestamptz '2026-09-04 15:00:00+00', 3),
  (timestamptz '2026-09-04 16:00:00+00', 3),
  (timestamptz '2026-09-04 17:00:00+00', 4),
  (timestamptz '2026-09-04 18:00:00+00', 3),
  (timestamptz '2026-09-04 19:00:00+00', 1),
  (timestamptz '2026-09-04 20:00:00+00', 2),
  (timestamptz '2026-09-04 21:00:00+00', 1),
  (timestamptz '2026-09-04 22:00:00+00', 2),
  (timestamptz '2026-09-05 05:00:00+00', 1),
  (timestamptz '2026-09-05 06:00:00+00', 1),
  (timestamptz '2026-09-05 07:00:00+00', 1),
  (timestamptz '2026-09-05 08:00:00+00', 2),
  (timestamptz '2026-09-05 09:00:00+00', 6),
  (timestamptz '2026-09-05 10:00:00+00', 1),
  -- О 11:18:14 вже спрацював тригер, тож із цієї години беремо лише три
  -- входи до нього, інакше один гість порахувався б двічі.
  (timestamptz '2026-09-05 11:00:00+00', 3)
) AS src(h, n)
CROSS JOIN LATERAL generate_series(1, src.n) AS i
WHERE NOT EXISTS (SELECT 1 FROM public.demo_session_log WHERE backfilled);

-- ----------------------------------------------------------------------------
-- Віддача без 'weekly'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_stats_full()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v jsonb;
BEGIN
  WITH real_teachers AS (
    SELECT u.id, u.created_at, u.last_sign_in_at
    FROM auth.users u
    WHERE u.is_anonymous = false
      AND coalesce(u.raw_app_meta_data ->> 'platform_role', '') <> 'admin'
      AND coalesce(u.raw_app_meta_data ->> 'internal_account', '') NOT IN ('true', 't')
  ),
  real_classes AS (
    SELECT c.*
    FROM public.classes c
    JOIN real_teachers t ON t.id = c.teacher_id
    WHERE c.deleted_at IS NULL AND c.is_public_demo = false AND c.is_demo = false
  ),
  real_students AS (
    SELECT s.* FROM public.students s
    JOIN real_classes c ON c.id = s.class_id
    WHERE s.deleted_at IS NULL
  ),
  real_entries AS (
    SELECT e.* FROM public.star_entries e
    JOIN real_classes c ON c.id = e.class_id
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'teachers', jsonb_build_object(
      'total',   (SELECT count(*) FROM real_teachers),
      'new_7d',  (SELECT count(*) FROM real_teachers WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT count(*) FROM real_teachers WHERE created_at > now() - interval '30 days'),
      'active_7d', (SELECT count(DISTINCT c.teacher_id) FROM real_entries e
                    JOIN real_classes c ON c.id = e.class_id
                    WHERE e.created_at > now() - interval '7 days'),
      'with_class', (SELECT count(DISTINCT teacher_id) FROM real_classes)
    ),
    'classes', jsonb_build_object(
      'active',   (SELECT count(*) FROM real_classes WHERE archived_at IS NULL),
      'archived', (SELECT count(*) FROM real_classes WHERE archived_at IS NOT NULL),
      'avg_students', (SELECT round(avg(cnt), 1) FROM (
                        SELECT count(s.id) AS cnt FROM real_classes c
                        LEFT JOIN real_students s ON s.class_id = c.id
                        GROUP BY c.id) q)
    ),
    'students', jsonb_build_object(
      'total', (SELECT count(*) FROM real_students),
      'logged_in_ever', (SELECT count(DISTINCT ss.student_id) FROM public.student_sessions ss
                         JOIN real_students s ON s.id = ss.student_id),
      'sessions_active', (SELECT count(*) FROM public.student_sessions ss
                          JOIN real_students s ON s.id = ss.student_id
                          WHERE ss.expires_at > now())
    ),
    'activity', jsonb_build_object(
      'lessons', (SELECT count(*) FROM public.lessons l
                  JOIN real_classes c ON c.id = l.class_id WHERE l.deleted_at IS NULL),
      'entries_total', (SELECT count(*) FROM real_entries),
      'entries_7d', (SELECT count(*) FROM real_entries WHERE created_at > now() - interval '7 days'),
      'stars_total', (SELECT coalesce(sum(CASE WHEN student_id IS NOT NULL AND amount > 0 THEN amount
                                               WHEN student_id IS NULL THEN amount ELSE 0 END), 0)
                      FROM real_entries),
      'penalties', (SELECT count(*) FROM real_entries WHERE amount < 0)
    ),
    'prizes', jsonb_build_object(
      'individual_defined', (SELECT count(*) FROM public.prizes_individual p
                             JOIN real_classes c ON c.id = p.class_id WHERE p.deleted_at IS NULL),
      'class_defined', (SELECT count(*) FROM public.class_prizes p
                        JOIN real_classes c ON c.id = p.class_id WHERE p.deleted_at IS NULL),
      'given_total', (SELECT count(*) FROM public.prizes_given g
                      JOIN real_students s ON s.id = g.student_id),
      'individual_list', (SELECT coalesce(
          jsonb_agg(jsonb_build_object('emoji', x.emoji, 'name', x.name) ORDER BY x.sort_name),
          '[]'::jsonb) FROM (
          SELECT min(p.emoji) AS emoji, min(p.name) AS name, lower(btrim(p.name)) AS sort_name
          FROM public.prizes_individual p
          JOIN real_classes c ON c.id = p.class_id
          WHERE p.deleted_at IS NULL AND btrim(coalesce(p.name, '')) <> ''
          GROUP BY lower(btrim(p.name))) x),
      'class_list', (SELECT coalesce(
          jsonb_agg(jsonb_build_object('emoji', x.emoji, 'name', x.name) ORDER BY x.sort_name),
          '[]'::jsonb) FROM (
          SELECT min(p.emoji) AS emoji, min(p.name) AS name, lower(btrim(p.name)) AS sort_name
          FROM public.class_prizes p
          JOIN real_classes c ON c.id = p.class_id
          WHERE p.deleted_at IS NULL AND btrim(coalesce(p.name, '')) <> ''
          GROUP BY lower(btrim(p.name))) x)
    ),
    'entry_types', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT t.icon, t.name, count(e.id)::int AS uses,
               coalesce(sum(e.amount), 0)::int AS stars
        FROM real_entries e
        JOIN public.entry_types t ON t.id = e.entry_type_id
        GROUP BY t.icon, t.name ORDER BY count(e.id) DESC LIMIT 8) x),
    'daily', (SELECT coalesce(jsonb_agg(x ORDER BY x.day), '[]'::jsonb) FROM (
        SELECT to_char(d.day, 'DD.MM') AS day_label,
               d.day,
               (SELECT count(*) FROM real_teachers t
                 WHERE date_trunc('day', t.created_at AT TIME ZONE 'Europe/Kyiv') = d.day)::int AS teachers,
               (SELECT count(*) FROM public.demo_session_log g
                 WHERE date_trunc('day', g.started_at AT TIME ZONE 'Europe/Kyiv') = d.day)::int AS demos
        FROM generate_series(
               date_trunc('day', now() AT TIME ZONE 'Europe/Kyiv') - interval '29 days',
               date_trunc('day', now() AT TIME ZONE 'Europe/Kyiv'),
               interval '1 day') AS d(day)) x),
    'demo', jsonb_build_object(
      'sessions_24h', (SELECT count(*) FROM public.demo_session_log
                       WHERE started_at > now() - interval '24 hours'),
      'sessions_7d', (SELECT count(*) FROM public.demo_session_log
                      WHERE started_at > now() - interval '7 days'),
      'sessions_30d', (SELECT count(*) FROM public.demo_session_log
                       WHERE started_at > now() - interval '30 days'),
      'total', (SELECT count(*) FROM public.demo_session_log),
      'tracking_since', (SELECT min(started_at) FROM public.demo_session_log),
      'live_now', (SELECT count(*) FROM auth.users WHERE is_anonymous)
    )
  ) INTO v;

  RETURN v;
END;
$fn$;

REVOKE ALL ON FUNCTION public.platform_stats_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_stats_full() TO service_role;

COMMIT;
