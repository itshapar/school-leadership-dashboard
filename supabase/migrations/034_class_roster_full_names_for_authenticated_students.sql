-- ============================================================================
-- 034_class_roster_full_names_for_authenticated_students.sql
-- Свідома зміна моделі (Етап 9.7, живий фідбек): публічна сторінка класу
-- /class/[код] тепер вимагає PIN учня ПЕРЕД показом будь-чого (раніше була
-- відкрита без входу — див. коментар у public_class_overview: "full_name
-- у цих типах немає навмисно"). Той анонімний контракт СВІДОМО не чіпаємо
-- (жодна публічна функція для АНОНІМНОГО виклику full_name і далі не
-- віддає) — натомість окрема функція, яка вимагає ЧИННИЙ токен сесії
-- учня цього ж класу і лише тоді повертає ПІБ однокласників.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.public_class_roster(p_token text)
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
  v_student_id  uuid;
  v_cur_gen     int;
  v_class_id    uuid;
  v_result      jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN
    RETURN NULL;
  END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT ss.id, ss.pin_generation, ss.expires_at,
         s.id, s.pin_generation, s.class_id
    INTO v_session_id, v_sess_gen, v_expires,
         v_student_id, v_cur_gen, v_class_id
  FROM public.student_sessions ss
  JOIN public.students s ON s.id = ss.student_id AND s.deleted_at IS NULL
  JOIN public.classes  c ON c.id = s.class_id    AND c.deleted_at IS NULL
  WHERE ss.token_hash = v_hash;

  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Прострочена або відкликана сесія (те саме правило, що й у
  -- student_dashboard_by_session) — видалення сесії лишаємо тому виклику,
  -- тут просто відмовляємо.
  IF v_expires < now() OR v_sess_gen <> v_cur_gen THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'id', s.id,
           'full_name', s.full_name,
           'display_name', public.student_display_name(s.nickname, s.full_name),
           'avatar_emoji', s.avatar_emoji
         ) ORDER BY s.full_name)
    INTO v_result
  FROM public.students s
  WHERE s.class_id = v_class_id AND s.deleted_at IS NULL;

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.public_class_roster(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.public_class_roster(text) TO anon;
