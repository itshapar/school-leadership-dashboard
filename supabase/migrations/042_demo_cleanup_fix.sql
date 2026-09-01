-- ============================================================================
-- 042_demo_cleanup_fix.sql
-- Прибирання демо не працювало взагалі, і це виявилось лише під час перевірки
-- «а чи справді нічого не лишається після сесії».
--
-- Дві перепони, одна за одною:
--
--   1) classes.teacher_id → auth.users має правило NO ACTION (єдиний такий
--      зв'язок з auth.users у всій схемі, решта CASCADE). Тому DELETE
--      анонімного користувача, який устиг створити пісочницю, падав на
--      порушенні зовнішнього ключа. А пісочницю створює кожен гість демо,
--      тобто прибирання не спрацьовувало НІКОЛИ, попри обіцянку в Політиці
--      приватності.
--
--   2) на star_entries висить аудит-тригер, який пише teacher_id NOT NULL і
--      бере його з класу. Якщо спершу видалити клас, тригер на каскадному
--      видаленні нарахувань teacher_id уже не знаходить і падає з 23502.
--
-- Тому порядок жорсткий: нарахування (клас іще живий, аудит пишеться), потім
-- класи (решта каскадом), потім записи аудиту цих класів, потім користувачі.
--
-- Схему навмисно не міняли: правило NO ACTION на classes.teacher_id захищає
-- реальних вчителів від випадкового каскадного видалення класів разом з
-- акаунтом, і чіпати його заради демо не варто.
--
-- Застосовано до прод-БД 1 вересня 2026; разовий виклик прибрав 4 акаунти.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_stale_demo_users(p_older_than interval DEFAULT '6 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  CREATE TEMP TABLE _stale ON COMMIT DROP AS
  SELECT u.id
  FROM auth.users u
  WHERE u.is_anonymous = true
    AND u.created_at < now() - p_older_than;

  CREATE TEMP TABLE _stale_classes ON COMMIT DROP AS
  SELECT c.id
  FROM public.classes c
  JOIN _stale s ON s.id = c.teacher_id;

  DELETE FROM public.star_entries e USING _stale_classes c WHERE e.class_id = c.id;
  DELETE FROM public.classes c USING _stale_classes sc WHERE c.id = sc.id;
  DELETE FROM public.audit_log a USING _stale_classes c WHERE a.class_id = c.id;

  WITH doomed AS (
    DELETE FROM auth.users u USING _stale s WHERE u.id = s.id RETURNING 1
  )
  SELECT count(*) INTO v_count FROM doomed;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_stale_demo_users(interval) FROM PUBLIC;

COMMIT;
