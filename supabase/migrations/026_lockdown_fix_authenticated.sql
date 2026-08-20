-- ============================================================================
-- 026_lockdown_fix_authenticated.sql
-- Етап 8 · виправлення до 024 · застосовувати РАЗОМ із 024 (одразу після неї)
--
-- ЗНАЙДЕНО ПРИ АУДИТІ ЕТАПУ 8.
--
-- Міграція 024 закриває доступ до public_student_dashboard так:
--     REVOKE EXECUTE ... FROM PUBLIC, anon;
-- і супроводжує це коментарем «authenticated не мав і не має».
--
-- Коментар помилковий. Міграція 019 (рядок 380) видала:
--     GRANT EXECUTE ON FUNCTION public.public_student_dashboard(text, uuid)
--       TO anon, authenticated;
-- Перевірено на проді 2026-08-20: has_function_privilege('authenticated', …)
-- повертає true.
--
-- Наслідок, якби 024 застосували як є: реєстрація відкрита з Етапу 4, тож
-- будь-хто створює акаунт, бере код класу (а код ми самі радимо давати
-- батькам) і викликає RPC напряму через /rest/v1/rpc/. Функція SECURITY
-- DEFINER, тому RLS її не стримує — вона віддасть персональний дашборд
-- будь-якого учня будь-якого класу РАЗОМ ІЗ НОТАТКАМИ ВЧИТЕЛЯ.
--
-- Це рівно той ризик, який 024 мала закрити: «код класу = спільний секрет».
-- 024 закривала його лише для анонімів.
--
-- Що НЕ ламається після цього REVOKE:
--   • student_dashboard_by_session (022) викликає public_student_dashboard
--     всередині себе. Вона SECURITY DEFINER, тобто внутрішній виклик іде від
--     власника функції, а не від ролі клієнта — гранти викликача не важать.
--     Учнівський дашборд за PIN-сесією працює далі.
--   • public_class_overview не зачіпається: публічний ОГЛЯД класу (нікнейми,
--     зірки, прогрес призів, без нотаток) лишається за кодом для батьків —
--     як і передбачає PRD §5.7.
--
-- Що ЗМІНЮЄТЬСЯ свідомо: сторінка /class/[code]/student/[id] перестає
-- працювати і для залогіненого вчителя теж. Це очікувано — після 024 вона
-- retired, а фронтенд Етапу 8 більше на неї не посилається.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.public_student_dashboard(text, uuid)
  FROM PUBLIC, anon, authenticated;

-- service_role лишається: серверні потреби і майбутні адмінські сценарії.
GRANT EXECUTE ON FUNCTION public.public_student_dashboard(text, uuid)
  TO service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Перевірка після застосування (має лишитись рівно service_role):
--
--   select coalesce(
--            (select string_agg(g, ', ' order by g)
--             from unnest(array['anon','authenticated','service_role','public']) g
--             where has_function_privilege(g, p.oid, 'EXECUTE')), '—')
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'public_student_dashboard';
--
-- І контрольний позитивний тест — учнівський вхід за PIN мусить далі
-- працювати (scripts/test-fullname-leak.ts перевіряє обидві функції).
-- ----------------------------------------------------------------------------
