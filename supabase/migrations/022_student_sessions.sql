-- ============================================================================
-- 022_student_sessions.sql — Етап 4 (auth): учнівські сесії «код класу + PIN»
-- Адитивна. Не конфліктує з 020_post_deploy_cleanup.
--
-- Модель (затверджено Andrew, Етап 4):
--   • Вхід: код класу + PIN, БЕЗ вибору учня. Система знаходить учня перебором
--     bcrypt-перевірок у межах класу (≤ 60 учнів — ліміт Етапу 3) →
--     PIN-и МУСЯТЬ бути унікальні в межах класу (гарантує генерація, п.5–6).
--   • Сесія: opaque-токен 32 байти → у cookie; в БД лише sha256-хеш.
--     Довжина життя 400 днів (стеля Chrome), sliding-подовження.
--   • Відкликання: знімок pin_generation у сесії звіряється зі students.
--     pin_generation на КОЖНОМУ запиті → reset_student_pin() миттєво вбиває
--     всі сесії учня без чорних списків.
--   • Учнівська сесія НЕ є Supabase Auth-акаунтом і не дає ролі authenticated.
--     Анонімний шлях до даних — як і після Етапу 1, лише SECURITY DEFINER RPC.
--   • Анти-перебір: ліміти в БД (per-IP best-effort + per-class як
--     spoof-proof backstop) — математика в дизайн-документі.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Сесії. RLS увімкнено, політик НУЛЬ, грантів НУЛЬ:
--    таблицю торкаються лише SECURITY DEFINER функції.
-- ----------------------------------------------------------------------------
CREATE TABLE public.student_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,          -- sha256(hex) від opaque-токена
  pin_generation int  NOT NULL,                 -- знімок на момент входу
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL
);
CREATE INDEX student_sessions_student_idx ON public.student_sessions (student_id);

ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.student_sessions TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Журнал спроб входу (для лімітів і моніторингу).
--    class_id NULL = спроба з невідомим кодом класу.
-- ----------------------------------------------------------------------------
CREATE TABLE public.student_login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id     uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ip           inet,                            -- з route handler; best-effort
  success      boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sla_class_time_idx ON public.student_login_attempts (class_id, attempted_at DESC);
CREATE INDEX sla_ip_time_idx    ON public.student_login_attempts (ip, attempted_at DESC);
CREATE INDEX sla_time_idx       ON public.student_login_attempts (attempted_at);

ALTER TABLE public.student_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.student_login_attempts TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Вхід учня. SECURITY DEFINER, викликається роллю anon (через route
--    handler /api/student/login, який передає реальний IP).
--    Повертає jsonb:
--      { ok: true,  token, student_id, expires_at }
--      { ok: false, reason: 'invalid' | 'rate_limited' }
--    'invalid' єдиний і для невідомого коду, і для невірного PIN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_login(p_code text, p_pin text, p_ip inet DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  -- Пороги (обґрунтування — дизайн-документ Етапу 4)
  c_ip_fail_limit        constant int := 10;   -- фейлів з IP / 15 хв (best-effort: p_ip підробний при прямому виклику RPC)
  c_class_fail_limit_15m constant int := 20;   -- фейлів на клас / 15 хв (spoof-proof backstop)
  c_class_fail_limit_24h constant int := 200;  -- фейлів на клас / 24 год (ескалація)
  c_unknown_ip_limit     constant int := 10;   -- спроб невідомих кодів з IP / 15 хв

  v_class_id uuid;
  v_student  public.students%ROWTYPE;
  v_found    public.students%ROWTYPE;
  v_token    text;
  v_expires  timestamptz := now() + interval '400 days';
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- Гігієна: журнал спроб не тримаємо довше 48 год (ліміти рахуються по 24 год)
  DELETE FROM public.student_login_attempts WHERE attempted_at < now() - interval '48 hours';

  v_class_id := public.resolve_class_by_code(p_code);

  -- 3а. Невідомий код: окремий ліміт сканування кодів по IP (NULL-IP — спільне відро)
  IF v_class_id IS NULL THEN
    IF (SELECT count(*) FROM public.student_login_attempts a
        WHERE a.class_id IS NULL
          AND a.ip IS NOT DISTINCT FROM p_ip
          AND a.attempted_at > now() - interval '15 minutes') >= c_unknown_ip_limit THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
    END IF;
    INSERT INTO public.student_login_attempts (class_id, ip, success) VALUES (NULL, p_ip, false);
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- 3б. Ліміти на клас (головний, непідробний бар'єр) і на IP (best-effort).
  --     Відхилені через ліміт спроби ТЕЖ логуються як фейл: атака, що триває,
  --     продовжує лок сама себе.
  IF (SELECT count(*) FROM public.student_login_attempts a
      WHERE a.class_id = v_class_id AND NOT a.success
        AND a.attempted_at > now() - interval '15 minutes') >= c_class_fail_limit_15m
     OR
     (SELECT count(*) FROM public.student_login_attempts a
      WHERE a.class_id = v_class_id AND NOT a.success
        AND a.attempted_at > now() - interval '24 hours') >= c_class_fail_limit_24h
     OR
     (SELECT count(*) FROM public.student_login_attempts a
      WHERE a.ip IS NOT DISTINCT FROM p_ip AND NOT a.success
        AND a.attempted_at > now() - interval '15 minutes') >= c_ip_fail_limit
  THEN
    INSERT INTO public.student_login_attempts (class_id, ip, success) VALUES (v_class_id, p_ip, false);
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  -- 3в. Пошук учня перебором bcrypt у межах класу (≤ 60 × ~2-4 мс — прийнятно).
  FOR v_student IN
    SELECT s.* FROM public.students s
    WHERE s.class_id = v_class_id AND s.deleted_at IS NULL AND s.pin_hash IS NOT NULL
  LOOP
    IF v_student.pin_hash = extensions.crypt(p_pin, v_student.pin_hash) THEN
      v_found := v_student;
      -- НЕ виходимо одразу: добігаємо цикл до кінця, щоб час відповіді
      -- не виказував позицію учня в списку.
    END IF;
  END LOOP;

  IF v_found.id IS NULL THEN
    INSERT INTO public.student_login_attempts (class_id, ip, success) VALUES (v_class_id, p_ip, false);
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- 3г. Успіх: сесія
  INSERT INTO public.student_login_attempts (class_id, ip, success) VALUES (v_class_id, p_ip, true);

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.student_sessions (student_id, token_hash, pin_generation, expires_at)
  VALUES (v_found.id,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          v_found.pin_generation,
          v_expires);

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'student_id', v_found.id,
    'expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_login(text, text, inet) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.student_login(text, text, inet) TO anon, service_role;

-- ----------------------------------------------------------------------------
-- 4. Дашборд за сесією. Перевіряє токен, строк, pin_generation, soft delete;
--    робить sliding-подовження; віддає той самий payload, що
--    public_student_dashboard (без full_name — механізм Етапу 1 reuse).
--    NULL = сесія невалідна → фронт показує форму PIN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_dashboard_by_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_hash        text;
  v_session_id  uuid;
  v_sess_gen    int;
  v_expires     timestamptz;
  v_last_seen   timestamptz;
  v_student_id  uuid;
  v_cur_gen     int;
  v_code        text;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN
    RETURN NULL;
  END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT ss.id, ss.pin_generation, ss.expires_at, ss.last_seen_at,
         s.id, s.pin_generation, c.public_code
    INTO v_session_id, v_sess_gen, v_expires, v_last_seen,
         v_student_id, v_cur_gen, v_code
  FROM public.student_sessions ss
  JOIN public.students s ON s.id = ss.student_id AND s.deleted_at IS NULL
  JOIN public.classes  c ON c.id = s.class_id    AND c.deleted_at IS NULL
  WHERE ss.token_hash = v_hash;

  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Прострочена або відкликана (PIN скинуто → generation розійшовся) — стираємо
  IF v_expires < now() OR v_sess_gen <> v_cur_gen THEN
    DELETE FROM public.student_sessions WHERE id = v_session_id;
    RETURN NULL;
  END IF;

  -- Touch не частіше 1 раз/год; sliding-подовження, коли лишилось < 200 днів
  IF v_last_seen < now() - interval '1 hour' THEN
    UPDATE public.student_sessions
    SET last_seen_at = now(),
        expires_at   = CASE WHEN expires_at < now() + interval '200 days'
                            THEN now() + interval '400 days'
                            ELSE expires_at END
    WHERE id = v_session_id;
  END IF;

  -- Reuse бар'єра Етапу 1: та сама видача, той самий фільтр full_name
  RETURN public.public_student_dashboard(v_code, v_student_id);
END;
$$;

REVOKE ALL ON FUNCTION public.student_dashboard_by_session(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.student_dashboard_by_session(text) TO anon, service_role;

-- ----------------------------------------------------------------------------
-- 5. Вихід
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_logout(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  DELETE FROM public.student_sessions
  WHERE token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.student_logout(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.student_logout(text) TO anon, service_role;

-- ----------------------------------------------------------------------------
-- 6. reset_student_pin: + унікальність PIN у межах класу (вимога моделі
--    «код + PIN без вибору учня»). Лишається SECURITY INVOKER (RLS = власник).
--    Сесії окремо не чистимо: розбіжність pin_generation інвалідовує їх на
--    наступному ж запиті (п.4).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_class_id uuid;
  v_num int;
  v_pin text;
  v_taken boolean;
  v_tries int := 0;
  v_rows int;
BEGIN
  SELECT class_id INTO v_class_id
  FROM public.students
  WHERE id = p_student_id AND deleted_at IS NULL;
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Учня не знайдено або немає доступу';
  END IF;

  LOOP
    v_tries := v_tries + 1;
    v_num := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int;
    v_pin := lpad(((v_num & 2147483647) % 1000000)::text, 6, '0');

    -- колізія з однокласником? (~6×10⁻⁵ на спробу; цикл майже завжди 1 прохід)
    SELECT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.class_id = v_class_id
        AND s.id <> p_student_id
        AND s.deleted_at IS NULL
        AND s.pin_hash IS NOT NULL
        AND s.pin_hash = extensions.crypt(v_pin, s.pin_hash)
    ) INTO v_taken;

    EXIT WHEN NOT v_taken;
    IF v_tries >= 20 THEN
      RAISE EXCEPTION 'Не вдалося згенерувати унікальний PIN, спробуйте ще раз';
    END IF;
  END LOOP;

  UPDATE public.students
  SET pin_hash       = extensions.crypt(v_pin, extensions.gen_salt('bf')),
      pin_set_at     = now(),
      pin_generation = pin_generation + 1
  WHERE id = p_student_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Учня не знайдено або немає доступу';
  END IF;
  RETURN v_pin;
END;
$$;
-- ACL зберігається з 019a/019b (CREATE OR REPLACE не скидає гранти).

-- ----------------------------------------------------------------------------
-- 7. Масова генерація PIN-ів класу — для першої роздачі та пам'ятки
--    «код класу + PIN-и» (Етап 6). SECURITY INVOKER: RLS гарантує власника.
--    PIN-и видаються відкритим текстом РІВНО ОДИН РАЗ.
--    Унікальність: усі PIN-и класу генеруються разом → перевірка по масиву.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_class_pins(p_class_id uuid)
RETURNS TABLE (student_id uuid, pin text)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_pins text[] := '{}';
  v_sid  uuid;
  v_num  int;
  v_pin  text;
BEGIN
  -- клас видимий під RLS? (інакше — нічого не знайдено)
  PERFORM 1 FROM public.classes WHERE id = p_class_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Клас не знайдено або немає доступу';
  END IF;

  FOR v_sid IN
    SELECT s.id FROM public.students s
    WHERE s.class_id = p_class_id AND s.deleted_at IS NULL
    ORDER BY s.created_at
  LOOP
    LOOP
      v_num := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int;
      v_pin := lpad(((v_num & 2147483647) % 1000000)::text, 6, '0');
      EXIT WHEN NOT (v_pin = ANY (v_pins));
    END LOOP;
    v_pins := v_pins || v_pin;

    UPDATE public.students
    SET pin_hash       = extensions.crypt(v_pin, extensions.gen_salt('bf')),
        pin_set_at     = now(),
        pin_generation = pin_generation + 1
    WHERE id = v_sid;

    student_id := v_sid;
    pin        := v_pin;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_class_pins(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_class_pins(uuid) TO authenticated, service_role;

COMMIT;
