-- ============================================================================
-- 019b_fix_function_grants.sql
-- Корекція 019a: дві функції МАЮТЬ бути виконуваними НЕ через API, але від
-- імені ролі, що пише в таблиці:
--   • generate_class_public_code() — DEFAULT стовпця classes.public_code:
--     виконується від імені того, хто робить INSERT (authenticated /
--     service_role);
--   • assert_class_writable(uuid) — викликається зсередини SECURITY INVOKER
--     тригерів-guard'ів, тобто теж від імені того, хто пише.
-- Сам тригерний виклик guard-функцій ACL не перевіряє (перевірка була при
-- CREATE TRIGGER), а от вкладений виклик assert_class_writable — перевіряє.
-- anon лишається без EXECUTE на обидві.
-- (ЗАСТОСОВАНО НА ПРОДІ 2026-08-18; перевірено живим INSERT під роллю
-- authenticated з uid вчителя: місток заповнив entry_type_id, guard-и і
-- audit-тригер відпрацювали.)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.generate_class_public_code() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_class_writable(uuid)  TO authenticated, service_role;
