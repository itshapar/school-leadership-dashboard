-- ============================================================================
-- 044_platform_stats_full.sql
-- Повна статистика платформи одним запитом, для сторінки /stats.
--
-- Окрема функція, а не десяток запитів зі сторінки: один похід у базу замість
-- п'ятнадцяти, і правило «що вважати справжніми даними» лежить в одному місці.
--
-- Скрізь виключені анонімні гості демо, демо-класи й публічний демо-клас:
-- інакше кожен перегляд туторіала виглядав би як новий вчитель із класом на
-- 12 учнів, і графік зростання показував би неправду. Демо рахується окремим
-- блоком.
--
-- Даних учнів функція не віддає: жодних імен, нікнеймів чи нотаток, лише
-- лічильники. Назви нагород і типів нарахувань, це словники вчителя.
--
-- Доступ: ЛИШЕ service_role. Ані anon, ані звичайний залогінений вчитель
-- викликати не можуть, навіть знаючи назву. Сторінка /stats додатково
-- вимагає platform_role=admin у app_metadata (міграція 023).
--
-- Застосовано до прод-БД 2 вересня 2026.
-- ============================================================================

BEGIN;

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
      'top_given', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
          SELECT p.emoji, p.name, count(*)::int AS given
          FROM public.prizes_given g
          JOIN real_students s ON s.id = g.student_id
          JOIN public.prizes_individual p ON p.id = g.prize_id
          GROUP BY p.emoji, p.name ORDER BY count(*) DESC LIMIT 8) x),
      'top_defined', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
          SELECT p.emoji, p.name, count(*)::int AS classes, round(avg(p.stars_required))::int AS avg_stars
          FROM public.prizes_individual p
          JOIN real_classes c ON c.id = p.class_id
          WHERE p.deleted_at IS NULL
          GROUP BY p.emoji, p.name ORDER BY count(*) DESC LIMIT 8) x)
    ),
    'entry_types', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT t.icon, t.name, count(e.id)::int AS uses,
               coalesce(sum(e.amount), 0)::int AS stars
        FROM real_entries e
        JOIN public.entry_types t ON t.id = e.entry_type_id
        GROUP BY t.icon, t.name ORDER BY count(e.id) DESC LIMIT 8) x),
    'weekly', (SELECT coalesce(jsonb_agg(x ORDER BY x.week), '[]'::jsonb) FROM (
        SELECT to_char(w.week, 'DD.MM') AS week_label,
               w.week,
               (SELECT count(*) FROM real_teachers t
                 WHERE date_trunc('week', t.created_at) = w.week)::int AS teachers,
               (SELECT count(*) FROM real_entries e
                 WHERE date_trunc('week', e.created_at) = w.week)::int AS entries,
               (SELECT coalesce(sum(CASE WHEN e.amount > 0 THEN e.amount ELSE 0 END), 0) FROM real_entries e
                 WHERE date_trunc('week', e.created_at) = w.week)::int AS stars
        FROM generate_series(date_trunc('week', now()) - interval '9 weeks',
                             date_trunc('week', now()), interval '1 week') AS w(week)) x),
    'demo', jsonb_build_object(
      'sessions_24h', (SELECT count(*) FROM auth.users
                       WHERE is_anonymous AND created_at > now() - interval '24 hours'),
      'sessions_7d', (SELECT count(*) FROM auth.users
                      WHERE is_anonymous AND created_at > now() - interval '7 days'),
      'live_now', (SELECT count(*) FROM auth.users WHERE is_anonymous)
    )
  ) INTO v;

  RETURN v;
END;
$fn$;

REVOKE ALL ON FUNCTION public.platform_stats_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_stats_full() TO service_role;

COMMIT;
