-- ============================================================================
-- 023_platform_admin.sql — Етап 4 (auth): адміністратор платформи
-- Адитивна. Не конфліктує з 020_post_deploy_cleanup.
--
-- Принцип (затверджено): адмін-роль НЕ ослаблює модель ізоляції.
--   • На таблиці даних НЕ додається ЖОДНОЇ політики з «OR platform_role…» —
--     «строго teacher_id = auth.uid()» лишається дослівно.
--   • Роль зберігається в auth.users.raw_app_meta_data → потрапляє в JWT
--     (app_metadata недоступна для редагування користувачем) → перевіряється
--     без запиту в БД і без ризику рекурсії RLS.
--   • Адмін-можливості — лише окремі SECURITY DEFINER RPC, які самі
--     перевіряють роль і віддають ТІЛЬКИ агрегати без персональних даних
--     учнів (жодних імен/нікнеймів/записів).
--   • Деструктивні дії (видалення акаунта-порушника) — НЕ через RLS/RPC,
--     а server-side route під service_role + Admin API, з audit-слідом.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Перевірка ролі. Викликається ЛИШЕ зсередини SECURITY DEFINER функцій
--    (ACL внутрішнього виклику перевіряється для власника-визначника,
--    тому грантів для ролей API не потрібно — і не даємо).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_platform_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF COALESCE((auth.jwt() -> 'app_metadata' ->> 'platform_role'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Доступ заборонено' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_platform_admin() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Агрегована статистика платформи (нуль персональних даних учнів)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.assert_platform_admin();

  RETURN jsonb_build_object(
    'teachers_total',   (SELECT count(*) FROM auth.users),
    'teachers_7d',      (SELECT count(*) FROM auth.users
                         WHERE created_at > now() - interval '7 days'),
    'classes_active',   (SELECT count(*) FROM public.classes
                         WHERE deleted_at IS NULL AND archived_at IS NULL),
    'classes_archived', (SELECT count(*) FROM public.classes
                         WHERE deleted_at IS NULL AND archived_at IS NOT NULL),
    'students_active',  (SELECT count(*) FROM public.students WHERE deleted_at IS NULL),
    'star_entries_total', (SELECT count(*) FROM public.star_entries),
    'star_entries_7d',  (SELECT count(*) FROM public.star_entries
                         WHERE created_at > now() - interval '7 days'),
    'student_sessions_active', (SELECT count(*) FROM public.student_sessions
                                WHERE expires_at > now()),
    'login_fails_24h',  (SELECT count(*) FROM public.student_login_attempts
                         WHERE NOT success AND attempted_at > now() - interval '24 hours'),
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Огляд вчителів: email + лічильники (це дані ВЧИТЕЛІВ як користувачів
--    платформи, потрібні для супроводу/анти-абузу; даних УЧНІВ тут немає)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_teacher_overview()
RETURNS TABLE (
  teacher_id      uuid,
  email           text,
  registered_at   timestamptz,
  last_sign_in_at timestamptz,
  classes_count   bigint,
  students_count  bigint,
  entries_30d     bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.assert_platform_admin();

  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at,
         (SELECT count(*) FROM public.classes c
           WHERE c.teacher_id = u.id AND c.deleted_at IS NULL),
         (SELECT count(*) FROM public.students s
           JOIN public.classes c ON c.id = s.class_id
           WHERE c.teacher_id = u.id AND s.deleted_at IS NULL),
         (SELECT count(*) FROM public.star_entries se
           JOIN public.classes c ON c.id = se.class_id
           WHERE c.teacher_id = u.id
             AND se.created_at > now() - interval '30 days')
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_teacher_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_teacher_overview() TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- РУЧНИЙ КРОК ПІСЛЯ МІГРАЦІЇ (не в міграції — прив'язка до конкретного акаунта;
-- на майбутніх середовищах uid буде інший):
--
--   UPDATE auth.users
--   SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
--                           || '{"platform_role":"admin"}'::jsonb
--   WHERE id = '037e7f5f-0f0b-454c-b041-601d2f27eb2a';  -- Andrew
--
-- Роль з'явиться в JWT після наступного оновлення токена (~до 1 год або
-- після повторного входу).
-- ============================================================================
