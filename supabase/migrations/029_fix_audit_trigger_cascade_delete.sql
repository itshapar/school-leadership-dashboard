-- ============================================================================
-- 029_fix_audit_trigger_cascade_delete.sql
-- Справжня причина бага "не вдалося видалити демо-дані" (Етап 9, live-тест).
--
-- audit_row_change() (018) шукає teacher_id через SELECT ... FROM classes
-- WHERE id = v_class. Коли DELETE FROM classes каскадно видаляє star_entries
-- (ON DELETE CASCADE), тригер AFTER DELETE на star_entries спрацьовує вже
-- ПІСЛЯ того, як батьківський рядок classes видалено в межах того самого
-- стейтменту — SELECT не бачить його, v_teacher = NULL, і INSERT в audit_log
-- падає на NOT NULL constraint. Уся операція DELETE відкочується.
--
-- Раніше знайдений RLS-фікс (027) на student_login_attempts/student_sessions
-- був реальним, але другорядним — оцей тригер і був первинною причиною.
--
-- Фікс: якщо клас уже видалено (v_teacher IS NULL), запис аудиту й так
-- належить тому, хто виконує операцію — auth.uid(). RLS-політика
-- classes_delete_own уже гарантує, що DELETE класу міг ініціювати лише його
-- власник, тож fallback на auth.uid() тут коректний, а не послаблення.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_class   uuid := coalesce(NEW.class_id, OLD.class_id);
  v_teacher uuid;
BEGIN
  SELECT c.teacher_id INTO v_teacher FROM public.classes c WHERE c.id = v_class;
  v_teacher := coalesce(v_teacher, auth.uid());

  INSERT INTO public.audit_log
    (actor, teacher_id, class_id, table_name, row_id, action, old_data, new_data)
  VALUES (
    auth.uid(), v_teacher, v_class, TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id), TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

COMMIT;
