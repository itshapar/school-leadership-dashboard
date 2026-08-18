-- ============================================================================
-- verify_etap3.sql — перевірка після застосування 014–019 (Фаза A).
-- Не міграція! Читає, нічого не змінює. Кожен блок має «ОЧІКУВАНО».
-- Еталонний знімок прода зроблено 2026-08-18 ПЕРЕД міграцією:
--   star_entries: 1374 (lesson 1321, з них 210 з amount=−1; bonus 53; penalty 0)
--   суми amount по класах: 7А 339 · 7Б 316 · 7В 152 · 7Г 228 · 7Д 262 · 7Е 198
--   суми лише додатних:    7А 359 · 7Б 346 · 7В 176 · 7Г 285 · 7Д 301 · 7Е 238
--   пороги (game/pizza):   7А 250/400 · 7Б 250/500 · 7В 100/200 · 7Г 200/400 ·
--                          7Д 200/400 · 7Е 200/350
-- ============================================================================

-- 1. Жодного запису без типу. ОЧІКУВАНО: 0
SELECT count(*) AS entries_without_type
FROM star_entries WHERE entry_type_id IS NULL;

-- 2. Мапінг enum → тип без розбіжностей. ОЧІКУВАНО: 0
SELECT count(*) AS type_mismatches
FROM star_entries e JOIN entry_types t ON t.id = e.entry_type_id
WHERE t.legacy_type IS DISTINCT FROM e.type;

-- 3. Розподіл за типами. ОЧІКУВАНО: Урок 1321 · Бонус 53 · Штраф 0 (у 6 класах)
SELECT t.name, count(e.id) AS n, coalesce(sum(e.amount), 0) AS sum_amount
FROM entry_types t LEFT JOIN star_entries e ON e.entry_type_id = t.id
GROUP BY t.name ORDER BY t.name;

-- 4. Суми по класах збігаються зі знімком (див. шапку). Amount не змінився.
SELECT c.name, count(e.id) AS n_entries, sum(e.amount) AS sum_amount,
       sum(e.amount) FILTER (WHERE e.amount > 0) AS sum_pos
FROM classes c LEFT JOIN star_entries e ON e.class_id = c.id
GROUP BY c.name ORDER BY c.name;

-- 5. Класові призи = старі пороги. ОЧІКУВАНО: 12 рядків (2 на клас), mismatch 0
SELECT count(*) AS class_prizes_total FROM class_prizes;
SELECT count(*) AS threshold_mismatches
FROM class_prizes p JOIN classes c ON c.id = p.class_id
WHERE (p.legacy_source = 'game_day'  AND p.threshold <> c.game_day_threshold)
   OR (p.legacy_source = 'pizza_day' AND p.threshold <> c.pizza_day_threshold);

-- 6. Кожен клас має 3 типи нарахувань. ОЧІКУВАНО: 6 рядків по 3
SELECT c.name, count(t.id) AS n_types
FROM classes c LEFT JOIN entry_types t ON t.class_id = c.id
GROUP BY c.name ORDER BY c.name;

-- 7. Паралель «7»: усі 6 класів привʼязані. ОЧІКУВАНО: 6
SELECT count(*) AS classes_in_parallel_7
FROM classes c JOIN parallels p ON p.id = c.parallel_id
WHERE p.name = '7' AND p.school_id IS NULL;

-- 8. Модель доступу Етапу 1 не зламана.
-- ОЧІКУВАНО: 0 політик для anon; 0 табличних грантів для anon
SELECT count(*) AS anon_policies
FROM pg_policies WHERE schemaname = 'public' AND roles::text LIKE '%anon%';
SELECT count(*) AS anon_table_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon';

-- 9. Кожна таблиця має 4 політики (SELECT/INSERT/UPDATE/DELETE)…
-- ОЧІКУВАНО: по 4 всюди, КРІМ config_templates (4) і audit_log (1 — лише SELECT)
SELECT tablename, count(*) AS n_policies,
       count(*) FILTER (WHERE with_check IS NOT NULL) AS n_with_check
FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename ORDER BY tablename;

-- 10. Системний шаблон рівно один. ОЧІКУВАНО: 1
SELECT count(*) AS system_templates FROM config_templates WHERE is_system;

-- 11. Публічні RPC живі і не віддають full_name. ОЧІКУВАНО: obj IS NOT NULL,
-- leaks_full_name = false (перевір на всіх 6 кодах; тут — 7А)
SELECT (public.public_class_overview('KBCDTRVGM4') IS NOT NULL)       AS overview_works,
       position('full_name' IN public.public_class_overview('KBCDTRVGM4')::text) > 0
         AS leaks_full_name;

-- 12. Усі функції мають закріплений search_path (SECURITY DEFINER — особливо).
-- ОЧІКУВАНО: proconfig не NULL всюди; 'extensions' у search_path — лише в тих,
-- що використовують pgcrypto (generate_class_public_code, reset_student_pin)
SELECT p.proname, p.prosecdef, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 13. Smoke анти-абуз лімітів і архіву — виконувати ВРУЧНУ в транзакції
-- з відкатом (потрібна роль вчителя або service_role + підстановка uid):
-- BEGIN;
--   UPDATE classes SET archived_at = now() WHERE name = '7А';
--   INSERT INTO star_entries (class_id, student_id, entry_type_id, amount)
--     VALUES (...);            -- ОЧІКУВАНО: помилка «Клас архівовано»
-- ROLLBACK;
