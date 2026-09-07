-- ============================================================================
-- 051_platform_stats_prize_usage.sql
-- Нагороди в статистиці платформи: не перелік назв, а табличка з ужитком.
--
-- Досі platform_stats_full віддавав просто список різних назв нагород, і на
-- сторінці вони лежали купкою бейджиків. З них видно, ЩО вчителі вигадують,
-- але не видно, що з цього справді працює: скільки класів завело таку
-- нагороду, за скільки зірок її ставлять і чи хтось до неї дійшов.
--
-- Тому кожна назва тепер приходить рядком:
--   • emoji і name — у найпоширенішому написанні серед класів (мода, а не
--     перший-ліпший рядок): назви групуються без урахування регістру, тож
--     «Піца» і «піца» це одна нагорода, і показати треба той варіант, який
--     трапляється частіше;
--   • classes — у скількох класах заведена;
--   • stars_min / stars_max — поріг у зірках. Два числа, а не одне, бо той
--     самий «Кіндер» в одному класі коштує 10 зірок, а в іншому 30;
--   • given (індивідуальні) — скільки учнів її вже отримали;
--   • reached (класові) — скільки класів уже назбирало на неї, і
--     best_progress — найкращий прогрес до неї серед класів, у відсотках.
--
-- «Назбирав» для класу рахується так само, як на публічній сторінці класу:
-- сума обрізаних балансів учнів плюс класовий бонус (в'юхи міграцій 049,
-- 050). Не окремою формулою тут: щойно правило балансу зміниться, число в
-- статистиці поїде за ним, а не почне тихо розходитись зі сторінкою класу.
--
-- Решта віддачі не змінюється, тіло взяте з міграції 047.
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
  ),
  -- Скільки зірок у класу, тією ж міркою, що й на сторінці класу.
  class_totals AS (
    SELECT
      c.id AS class_id,
      coalesce((SELECT sum(b.stars)::int FROM public.student_star_balances b
                 WHERE b.class_id = c.id), 0)
      + coalesce((SELECT cb.stars FROM public.class_star_balances cb
                   WHERE cb.class_id = c.id), 0) AS stars
    FROM real_classes c
  ),
  ind_prizes AS (
    SELECT p.id, p.class_id, p.name, p.emoji, p.stars_required,
           lower(btrim(p.name)) AS key
    FROM public.prizes_individual p
    JOIN real_classes c ON c.id = p.class_id
    WHERE p.deleted_at IS NULL AND btrim(coalesce(p.name, '')) <> ''
  ),
  ind_given AS (
    SELECT p.key, count(*)::int AS given
    FROM public.prizes_given g
    JOIN ind_prizes p ON p.id = g.prize_id
    JOIN real_students s ON s.id = g.student_id
    GROUP BY p.key
  ),
  ind_rows AS (
    SELECT
      p.key,
      (SELECT x.name FROM ind_prizes x WHERE x.key = p.key
        GROUP BY x.name ORDER BY count(*) DESC, x.name LIMIT 1) AS name,
      (SELECT x.emoji FROM ind_prizes x WHERE x.key = p.key
        GROUP BY x.emoji ORDER BY count(*) DESC, x.emoji LIMIT 1) AS emoji,
      count(DISTINCT p.class_id)::int AS classes,
      min(p.stars_required)::int AS stars_min,
      max(p.stars_required)::int AS stars_max,
      coalesce((SELECT g.given FROM ind_given g WHERE g.key = p.key), 0) AS given
    FROM ind_prizes p
    GROUP BY p.key
  ),
  cls_prizes AS (
    SELECT p.id, p.class_id, p.name, p.emoji, p.threshold,
           lower(btrim(p.name)) AS key
    FROM public.class_prizes p
    JOIN real_classes c ON c.id = p.class_id
    WHERE p.deleted_at IS NULL AND btrim(coalesce(p.name, '')) <> ''
  ),
  cls_rows AS (
    SELECT
      p.key,
      (SELECT x.name FROM cls_prizes x WHERE x.key = p.key
        GROUP BY x.name ORDER BY count(*) DESC, x.name LIMIT 1) AS name,
      (SELECT x.emoji FROM cls_prizes x WHERE x.key = p.key
        GROUP BY x.emoji ORDER BY count(*) DESC, x.emoji LIMIT 1) AS emoji,
      count(DISTINCT p.class_id)::int AS classes,
      min(p.threshold)::int AS stars_min,
      max(p.threshold)::int AS stars_max,
      (count(DISTINCT p.class_id) FILTER (WHERE ct.stars >= p.threshold))::int AS reached,
      -- Пороги класових нагород високі, і колонка «назбирали» подекуди суцільні
      -- нулі. Найкращий прогрес показує, чи клас хоч наближається до мети, чи
      -- нагорода недосяжна й висить у налаштуваннях мертвою.
      coalesce(max(least(100, round(100.0 * ct.stars / nullif(p.threshold, 0)))), 0)::int AS best_progress
    FROM cls_prizes p
    JOIN class_totals ct ON ct.class_id = p.class_id
    GROUP BY p.key
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
      -- Спершу найужитковіші: сторінку читають, щоб побачити, що вчителі
      -- ставлять частіше, а не щоб знайти назву за алфавітом.
      'individual_list', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'emoji', r.emoji,
            'name', r.name,
            'classes', r.classes,
            'stars_min', r.stars_min,
            'stars_max', r.stars_max,
            'given', r.given
          ) ORDER BY r.classes DESC, r.given DESC, r.key), '[]'::jsonb)
        FROM ind_rows r),
      'class_list', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'emoji', r.emoji,
            'name', r.name,
            'classes', r.classes,
            'stars_min', r.stars_min,
            'stars_max', r.stars_max,
            'reached', r.reached,
            'best_progress', r.best_progress
          ) ORDER BY r.classes DESC, r.reached DESC, r.key), '[]'::jsonb)
        FROM cls_rows r)
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
