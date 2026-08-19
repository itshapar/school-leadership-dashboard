-- ============================================================================
-- 021_teacher_profiles.sql — Етап 4 (auth): профіль вчителя
-- Адитивна. Не конфліктує з 020_post_deploy_cleanup (не чіпає легасі).
--
-- Профіль (PRD §5.1): ім'я для відображення + назва школи (опційно).
-- НЕ несе авторизаційної семантики: ролі тут НЕ зберігаються.
-- Роль «адмін платформи» живе в auth.users.raw_app_meta_data (див. 023).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Таблиця
-- ----------------------------------------------------------------------------
CREATE TABLE public.teacher_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        text NOT NULL DEFAULT '',
  school_display_name text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_profiles_display_name_len CHECK (char_length(display_name) <= 100),
  CONSTRAINT teacher_profiles_school_len       CHECK (char_length(school_display_name) <= 200)
);

COMMENT ON TABLE public.teacher_profiles IS
  'Профіль вчителя для відображення (PRD §5.1). Без авторизаційної семантики.';

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS: строго свій рядок. INSERT робить лише тригер (definer),
--    DELETE — каскад від auth.users (hard_delete_teacher_account / Admin API).
-- ----------------------------------------------------------------------------
CREATE POLICY teacher_profiles_select ON public.teacher_profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY teacher_profiles_update ON public.teacher_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Гранти — explicit-only (патерн 019a/019b)
REVOKE ALL ON public.teacher_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.teacher_profiles TO authenticated;
GRANT UPDATE (display_name, school_display_name, updated_at)
  ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;

-- ----------------------------------------------------------------------------
-- 3. updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
-- SECURITY INVOKER тригер-функція: виконується від імені того, хто пише
-- (грабля 019b) → EXECUTE потрібен authenticated.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO authenticated, service_role;

CREATE TRIGGER teacher_profiles_touch
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Автостворення профілю при реєстрації (email І Google OAuth).
--    SECURITY DEFINER: тригер на auth.users спрацьовує від supabase_auth_admin,
--    який не має прав на public.teacher_profiles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.teacher_profiles (id, display_name)
  VALUES (
    NEW.id,
    LEFT(COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),  -- наша форма реєстрації
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),     -- Google OAuth
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),          -- Google OAuth (fallback)
      split_part(COALESCE(NEW.email, ''), '@', 1),
      ''
    ), 100)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Бекфіл наявних акаунтів (Andrew)
-- ----------------------------------------------------------------------------
INSERT INTO public.teacher_profiles (id, display_name)
SELECT u.id,
       LEFT(COALESCE(
         NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
         NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
         split_part(COALESCE(u.email, ''), '@', 1),
         ''
       ), 100)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

COMMIT;
