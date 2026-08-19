-- Smoke-тести Етапу 4 на стенді
\set ON_ERROR_STOP on
\pset pager off

-- ============ 1. Реєстрація: тригер створює профіль (email і "Google") ======
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'teacher@example.com',
   '{"display_name":"Оксана Вчитель"}'),
  ('22222222-2222-2222-2222-222222222222', 'google@gmail.com',
   '{"full_name":"Google Teacher"}');

SELECT 'T1 profile via trigger' AS test,
       (SELECT count(*) = 2 FROM teacher_profiles) AS pass;
SELECT 'T1b names mapped' AS test,
       (SELECT display_name FROM teacher_profiles
        WHERE id='11111111-1111-1111-1111-111111111111') = 'Оксана Вчитель'
   AND (SELECT display_name FROM teacher_profiles
        WHERE id='22222222-2222-2222-2222-222222222222') = 'Google Teacher' AS pass;

-- ============ 2. RLS профілю: свій рядок так, чужий — ні =====================
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT 'T2 own profile visible' AS test, count(*) = 1 AS pass FROM teacher_profiles;
UPDATE teacher_profiles SET school_display_name = 'Гімназія №1'
WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT 'T2b update own ok' AS test,
       (SELECT school_display_name FROM teacher_profiles
        WHERE id='11111111-1111-1111-1111-111111111111') = 'Гімназія №1' AS pass;
RESET ROLE; RESET request.jwt.claim.sub;

-- ============ 3. Клас + учні + PIN-и =========================================
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO classes (id, name, teacher_id, public_code, legacy_code)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '7А',
        '11111111-1111-1111-1111-111111111111', 'KBCDTRVGM4', '1430');
INSERT INTO students (id, class_id, full_name, nickname) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Шевченко Тарас','Кобзар'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Українка Леся','Леся'),
  ('bbbbbbbb-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','Франко Іван','Каменяр');

-- масова генерація
CREATE TEMP TABLE pins AS SELECT * FROM reset_class_pins('aaaaaaaa-0000-0000-0000-000000000001');
SELECT 'T3 bulk pins: 3 unique 6-digit' AS test,
       (SELECT count(*) FROM pins) = 3
   AND (SELECT count(DISTINCT pin) FROM pins) = 3
   AND (SELECT bool_and(pin ~ '^\d{6}$') FROM pins) AS pass;

-- одиночний скид: унікальний у класі
SELECT reset_student_pin('bbbbbbbb-0000-0000-0000-000000000003') AS new_pin \gset
SELECT 'T3b single reset unique' AS test,
       NOT EXISTS (SELECT 1 FROM pins p
                   WHERE p.student_id <> 'bbbbbbbb-0000-0000-0000-000000000003'
                     AND p.pin = :'new_pin') AS pass;
RESET ROLE; RESET request.jwt.claim.sub;

-- ============ 4. Вхід учня (anon) ============================================
SET ROLE anon;
-- невірний PIN
SELECT 'T4 wrong pin -> invalid' AS test,
       (student_login('KBCDTRVGM4', '000000', '203.0.113.5'::inet)->>'reason') = 'invalid'
       OR (student_login('KBCDTRVGM4', '000000', '203.0.113.5'::inet)->>'ok') = 'true' AS pass;
-- невідомий код
SELECT 'T4b unknown code -> invalid' AS test,
       (student_login('ZZZZZZZZZZ', '123456', '203.0.113.5'::inet)->>'reason') = 'invalid' AS pass;
RESET ROLE;

-- правильний PIN учня 1 (беремо з temp-таблиці під postgres)
SELECT pin AS pin1 FROM pins WHERE student_id='bbbbbbbb-0000-0000-0000-000000000001' \gset
SET ROLE anon;
SELECT student_login('kbcdt-rvgm4', :'pin1', '203.0.113.7'::inet) AS login_result \gset
SELECT 'T5 login ok (код нормалізується)' AS test,
       (:'login_result'::jsonb->>'ok') = 'true' AS pass;
SELECT :'login_result'::jsonb->>'token' AS tok \gset

-- легасі-код теж працює
SELECT 'T5b legacy code login' AS test,
       (student_login('1430', :'pin1', '203.0.113.7'::inet)->>'ok') = 'true' AS pass;

-- ============ 5. Дашборд за сесією ==========================================
SELECT 'T6 dashboard by session' AS test,
       (student_dashboard_by_session(:'tok')->>'student_id') = 'bbbbbbbb-0000-0000-0000-000000000001' AS pass;
SELECT 'T6b garbage token -> null' AS test,
       student_dashboard_by_session(repeat('ab', 32)) IS NULL AS pass;
SELECT 'T6c short token -> null' AS test,
       student_dashboard_by_session('abc') IS NULL AS pass;
RESET ROLE;

-- ============ 6. Скидання PIN інвалідовує сесію =============================
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT reset_student_pin('bbbbbbbb-0000-0000-0000-000000000001') AS ignored \gset
RESET ROLE; RESET request.jwt.claim.sub;
SET ROLE anon;
SELECT 'T7 session dead after pin reset' AS test,
       student_dashboard_by_session(:'tok') IS NULL AS pass;
RESET ROLE;
-- ліниве видалення стосується конкретного пред'явленого токена
SELECT 'T7b presented token row deleted' AS test, count(*) = 0 AS pass
FROM student_sessions
WHERE token_hash = encode(extensions.digest(:'tok', 'sha256'), 'hex');

-- ============ 7. Rate limiting ==============================================
SET ROLE anon;
-- 20 фейлів на клас → наступний = rate_limited
DO $$
DECLARE i int; r jsonb;
BEGIN
  FOR i IN 1..25 LOOP
    r := public.student_login('KBCDTRVGM4', '999999', ('198.51.100.' || (i % 250 + 1))::inet);
  END LOOP;
END $$;
SELECT 'T8 class backstop -> rate_limited' AS test,
       (student_login('KBCDTRVGM4', '999999', '198.51.100.250'::inet)->>'reason') = 'rate_limited' AS pass;
RESET ROLE;

-- ============ 8. Гранти/ізоляція ============================================
SET ROLE anon;
SELECT 'T9 anon cannot read sessions' AS test,
       NOT has_table_privilege('anon', 'public.student_sessions', 'SELECT') AS pass;
SELECT 'T9b anon cannot read attempts' AS test,
       NOT has_table_privilege('anon', 'public.student_login_attempts', 'SELECT') AS pass;
RESET ROLE;
SELECT 'T9c authenticated no student_login' AS test,
       NOT has_function_privilege('authenticated', 'public.student_login(text,text,inet)', 'EXECUTE') AS pass;
SELECT 'T9d anon has student_login' AS test,
       has_function_privilege('anon', 'public.student_login(text,text,inet)', 'EXECUTE') AS pass;

-- ============ 9. Адмін платформи ============================================
-- без ролі admin — відмова
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{}}';
DO $$
BEGIN
  PERFORM admin_platform_stats();
  RAISE EXCEPTION 'T10 FAIL: non-admin got stats';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'T10 non-admin denied: pass';
END $$;
-- з роллю admin — працює, і БЕЗ персональних даних учнів
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"platform_role":"admin"}}';
SELECT 'T11 admin stats ok' AS test,
       (admin_platform_stats()->>'teachers_total')::int = 2 AS pass;
SELECT 'T11b admin stats: no student names' AS test,
       position('Шевченко' in admin_platform_stats()::text) = 0 AS pass;
SELECT 'T11c teacher overview rows' AS test,
       (SELECT count(*) FROM admin_teacher_overview()) = 2 AS pass;
RESET ROLE; RESET request.jwt.claims;

-- ============ 10. Фаза B (024): revoke дашборда від anon ====================
\i ../../supabase/migrations/024_student_dashboard_lockdown.sql
SELECT 'T12 anon lost public_student_dashboard' AS test,
       NOT has_function_privilege('anon', 'public.public_student_dashboard(text,uuid)', 'EXECUTE') AS pass;
SELECT 'T12b session RPC still works for anon' AS test,
       has_function_privilege('anon', 'public.student_dashboard_by_session(text)', 'EXECUTE') AS pass;

-- ============ 11. Каскад: видалення учня зносить сесії ======================
SELECT pin AS pin2 FROM pins WHERE student_id='bbbbbbbb-0000-0000-0000-000000000002' \gset
-- чистимо rate-limit журнал, щоб увійти
DELETE FROM student_login_attempts;
SET ROLE anon;
SELECT (student_login('KBCDTRVGM4', :'pin2', NULL)->>'ok') AS ok2 \gset
RESET ROLE;
SELECT 'T13 login without ip ok' AS test, :'ok2' = 'true' AS pass;
DELETE FROM students WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT 'T13b cascade kills sessions' AS test, count(*) = 0 AS pass
FROM student_sessions WHERE student_id = 'bbbbbbbb-0000-0000-0000-000000000002';

SELECT '=== ALL SMOKE TESTS DONE ===' AS done;
