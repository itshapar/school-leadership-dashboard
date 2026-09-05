-- ============================================================================
-- 046_platform_stats_v2.sql
-- Статистика платформи: чесні цифри демо і виключені службові акаунти.
--
-- Три речі, які були неправдою на сторінці /stats:
--
--   1) «Демо за добу» і «за тиждень» рахувались по анонімних користувачах у
--      auth.users, а pg_cron (міграція 043) прибирає їх щогодини, щойно
--      сесії виповниться 6 годин. Тобто обидва числа показували одне й те
--      саме: скільки гостей іще не встигли прибрати. Історії не існувало
--      взагалі, бо єдиний слід демо-сесії зникав разом із нею.
--
--      Тепер лік веде окрема таблиця demo_session_log: один рядок на одну
--      створену пісочницю, і в рядку ЛИШЕ мітка часу. Ні user_id, ні IP, ні
--      будь-чого, чим можна впізнати гостя, тож обіцянка «демо зникає разом
--      із сесією» лишається дослівною, а лічильник переживає прибирання.
--
--   2) У числа платформи входили власні акаунти: особистий акаунт власника
--      продукту і тестовий. Сімнадцять справжніх вчителів і два свої, це вже
--      не статистика, а самообман. Виключаються акаунти з platform_role=admin
--      або internal_account=true в app_metadata (метадані користувач змінити
--      не може, вони виставляються лише службовим ключем).
--
--      Позначати акаунт службовим:
--        UPDATE auth.users SET raw_app_meta_data =
--          coalesce(raw_app_meta_data, '{}'::jsonb) || '{"internal_account":true}'::jsonb
--        WHERE email = '…';
--      Робиться руками для конкретного середовища, тому пошт у міграції немає.
--
--   3) Нові вчителі показувались по тижнях, а на такому масштабі це два-три
--      стовпчики. Додано денний ряд за 30 днів (у київському часі, бо «нові
--      за сьогодні» має збігатися з тим, що людина бачить у календарі).
--
-- Прибрано з віддачі: top_given (які нагороди реально вручають) і top_defined
-- (найпопулярніші в налаштуваннях). Нагороди у вчителів надто різні, щоб
-- рейтинг щось означав. Натомість віддаємо просто перелік наявних нагород,
-- окремо індивідуальних і окремо для всього класу.
--
-- Даних учнів функція, як і раніше, не віддає: жодних імен, нікнеймів чи
-- нотаток, лише лічильники і словники вчителя.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Журнал запусків демо
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demo_session_log (
  id         bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_session_log_started_at_idx
  ON public.demo_session_log (started_at DESC);

-- RLS без жодної політики: читати й писати може лише service_role і
-- SECURITY DEFINER функції нижче. Вчителю й гостю таблиця недоступна.
ALTER TABLE public.demo_session_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.demo_session_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.demo_session_log_id_seq FROM PUBLIC, anon, authenticated;

-- Тригер, а не рядок усередині create_demo_sandbox: та функція на сто рядків
-- копіює клас цілком, і переписувати її заради одного INSERT означало б
-- ризикувати демо заради лічильника.
CREATE OR REPLACE FUNCTION public.log_demo_sandbox_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.demo_session_log DEFAULT VALUES;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_demo_sandbox_created ON public.classes;
CREATE TRIGGER trg_log_demo_sandbox_created
AFTER INSERT ON public.classes
FOR EACH ROW
WHEN (NEW.is_demo IS TRUE)
EXECUTE FUNCTION public.log_demo_sandbox_created();

-- ----------------------------------------------------------------------------
-- 2. Статистика
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
      -- Перелік, а не рейтинг: однакові за суттю нагороди вчителі називають
      -- по-різному, тож склеюємо лише дослівні збіги назви.
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
    'weekly', (SELECT coalesce(jsonb_agg(x ORDER BY x.week), '[]'::jsonb) FROM (
        SELECT to_char(w.week, 'DD.MM') AS week_label,
               w.week,
               (SELECT count(*) FROM real_entries e
                 WHERE date_trunc('week', e.created_at) = w.week)::int AS entries,
               (SELECT coalesce(sum(CASE WHEN e.amount > 0 THEN e.amount ELSE 0 END), 0) FROM real_entries e
                 WHERE date_trunc('week', e.created_at) = w.week)::int AS stars
        FROM generate_series(date_trunc('week', now()) - interval '9 weeks',
                             date_trunc('week', now()), interval '1 week') AS w(week)) x),
    -- Дні рахуються в київському часі: «нових за сьогодні» має збігатися з
    -- тим, що людина бачить у себе в календарі, а не з добою за UTC.
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
      -- Живі гості беруться з auth.users: це стан «прямо зараз», а не історія.
      'live_now', (SELECT count(*) FROM auth.users WHERE is_anonymous)
    )
  ) INTO v;

  RETURN v;
END;
$fn$;

REVOKE ALL ON FUNCTION public.platform_stats_full() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_stats_full() TO service_role;

COMMIT;
