-- Shim Supabase для локального стенда (патерн Етапу 1)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO postgres;

CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz
);

-- Мінімальна репліка прод-схеми (лише те, що торкають міграції 021–024)
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  public_code text UNIQUE,
  legacy_code text,
  school_id uuid, parallel_id uuid,
  archived_at timestamptz, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nickname text, avatar_emoji text, group_id uuid,
  pin_hash text, pin_set_at timestamptz, pin_generation int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.star_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY t_classes ON public.classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY t_students ON public.students FOR ALL TO authenticated
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()));
CREATE POLICY t_entries ON public.star_entries FOR ALL TO authenticated
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes, public.students, public.star_entries TO authenticated;

-- Наявні функції прода, які використовують нові міграції (точні копії)
CREATE OR REPLACE FUNCTION public.normalize_class_code(p_code text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp' AS
$$ SELECT upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); $$;

CREATE OR REPLACE FUNCTION public.resolve_class_by_code(p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS
$$
  SELECT c.id FROM classes c
  WHERE public.normalize_class_code(p_code) <> ''
    AND c.deleted_at IS NULL
    AND (c.public_code = public.normalize_class_code(p_code)
      OR c.legacy_code = public.normalize_class_code(p_code))
  LIMIT 1;
$$;

-- Стаб public_student_dashboard (прод повертає jsonb; тут — маркер)
CREATE OR REPLACE FUNCTION public.public_student_dashboard(p_code text, p_student_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS
$$
  SELECT jsonb_build_object('student_id', s.id, 'nickname', s.nickname, 'stub', true)
  FROM students s JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id AND c.public_code = public.normalize_class_code(p_code)
    AND s.deleted_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.public_student_dashboard(text, uuid) TO anon, service_role;

-- Оригінальний reset_student_pin з 018 (замінюється в 022)
CREATE OR REPLACE FUNCTION public.reset_student_pin(p_student_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'extensions', 'pg_temp' AS
$$
DECLARE v_num int; v_pin text; v_rows int;
BEGIN
  v_num := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int;
  v_pin := lpad(((v_num & 2147483647) % 1000000)::text, 6, '0');
  UPDATE public.students
  SET pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
      pin_set_at = now(), pin_generation = pin_generation + 1
  WHERE id = p_student_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'Учня не знайдено або немає доступу'; END IF;
  RETURN v_pin;
END; $$;
GRANT EXECUTE ON FUNCTION public.reset_student_pin(uuid) TO authenticated, service_role;
