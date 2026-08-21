-- ============================================================================
-- 033_reversible_pin_storage.sql
-- Свідома зміна моделі безпеки на прохання вчителя (Етап 9.3, live-фідбек):
-- PIN учня мусить бути видимий у списку учнів БУДЬ-КОЛИ, не лише одразу
-- після генерації. bcrypt-хеш (pin_hash, 018) технічно не дає це зробити —
-- хеш не оборотний. Перехід на симетричне шифрування pgcrypto
-- (pgp_sym_encrypt/decrypt): PIN можна розшифрувати знову, ключ живе лише
-- в тілі функцій, не в клієнтському коді й не в змінних середовища Vercel.
--
-- pin_hash НЕ видаляємо: старі PIN-и, згенеровані до цієї міграції,
-- лишаються робочими для входу учня (student_login перевіряє обидва
-- варіанти), просто НЕ показуються в списку, поки вчитель не натисне
-- "Роздрукувати піни класу" ще раз — тоді вони стають видимими назавжди.
--
-- КЛЮЧ ШИФРУВАННЯ ВИДАЛЕНО З ЦЬОГО ФАЙЛУ ПЕРЕД КОМІТОМ: секрет у git-
-- історії назавжди — навіть після заміни лишається читаним у попередніх
-- комітах. Реальний ключ уже застосовано до бази (цю міграцію користувач
-- виконав вручну через SQL Editor до редагування файлу) — тут лишився
-- лише плейсхолдер, щоб структура функцій була видна в git.
-- ============================================================================

BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin_encrypted bytea;

-- Масова генерація (кнопка "Роздрукувати піни класу").
CREATE OR REPLACE FUNCTION public.reset_class_pins(p_class_id uuid)
RETURNS TABLE(student_id uuid, pin text)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_key  constant text := '<REDACTED-BEFORE-COMMIT — див. примітку зверху файлу>';
  v_pins text[] := '{}';
  v_sid  uuid;
  v_num  int;
  v_pin  text;
BEGIN
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
        pin_encrypted  = extensions.pgp_sym_encrypt(v_pin, v_key),
        pin_set_at     = now(),
        pin_generation = pin_generation + 1
    WHERE id = v_sid;

    student_id := v_sid;
    pin        := v_pin;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Скидання PIN одному учню.
CREATE OR REPLACE FUNCTION public.reset_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_key      constant text := '<REDACTED-BEFORE-COMMIT — див. примітку зверху файлу>';
  v_class_id uuid;
  v_num      int;
  v_pin      text;
  v_taken    boolean;
  v_tries    int := 0;
  v_rows     int;
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
      pin_encrypted  = extensions.pgp_sym_encrypt(v_pin, v_key),
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

-- Прочитати вже видані PIN-и класу (нове, Етап 9.3) — лише власник класу,
-- і лише ті учні, кому PIN згенеровано ПІСЛЯ цієї міграції (pin_encrypted
-- заповнюється тільки reset-функціями вище).
CREATE OR REPLACE FUNCTION public.get_class_pins(p_class_id uuid)
RETURNS TABLE(student_id uuid, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_key constant text := '<REDACTED-BEFORE-COMMIT — див. примітку зверху файлу>';
BEGIN
  PERFORM 1 FROM public.classes
  WHERE id = p_class_id AND teacher_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Клас не знайдено або немає доступу';
  END IF;

  RETURN QUERY
  SELECT s.id, extensions.pgp_sym_decrypt(s.pin_encrypted, v_key)
  FROM public.students s
  WHERE s.class_id = p_class_id AND s.deleted_at IS NULL AND s.pin_encrypted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_class_pins(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_class_pins(uuid) TO authenticated;

-- Вхід учня: спершу новий (розшифровка), падаємо на старий bcrypt-шлях
-- для PIN-ів, згенерованих до цієї міграції і ще не оновлених.
CREATE OR REPLACE FUNCTION public.student_login(p_code text, p_pin text, p_ip inet DEFAULT NULL::inet)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  c_ip_fail_limit        constant int := 10;
  c_class_fail_limit_15m constant int := 20;
  c_class_fail_limit_24h constant int := 200;
  c_unknown_ip_limit     constant int := 10;
  v_key constant text := '<REDACTED-BEFORE-COMMIT — див. примітку зверху файлу>';

  v_class_id uuid;
  v_student  public.students%ROWTYPE;
  v_found    public.students%ROWTYPE;
  v_token    text;
  v_expires  timestamptz := now() + interval '400 days';
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  DELETE FROM public.student_login_attempts WHERE attempted_at < now() - interval '48 hours';

  v_class_id := public.resolve_class_by_code(p_code);

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

  FOR v_student IN
    SELECT s.* FROM public.students s
    WHERE s.class_id = v_class_id AND s.deleted_at IS NULL
      AND (s.pin_hash IS NOT NULL OR s.pin_encrypted IS NOT NULL)
  LOOP
    IF (v_student.pin_encrypted IS NOT NULL
        AND extensions.pgp_sym_decrypt(v_student.pin_encrypted, v_key) = p_pin)
       OR
       (v_student.pin_encrypted IS NULL
        AND v_student.pin_hash IS NOT NULL
        AND v_student.pin_hash = extensions.crypt(p_pin, v_student.pin_hash))
    THEN
      v_found := v_student;
    END IF;
  END LOOP;

  IF v_found.id IS NULL THEN
    INSERT INTO public.student_login_attempts (class_id, ip, success) VALUES (v_class_id, p_ip, false);
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

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

COMMIT;
