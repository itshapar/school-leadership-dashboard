-- ============================================================================
-- 019a_advisor_hardening.sql
-- Етап 3 · Фаза A · дрібне посилення за результатами Supabase security advisors
-- після застосування 014–019. (ЗАСТОСОВАНО НА ПРОДІ 2026-08-18 разом з 019b.)
--
-- 1) Тригерні/службові функції отримують дефолтний EXECUTE для PUBLIC при
--    створенні — відкликаємо. Тригери від цього не ламаються (їх викликає
--    система від імені власника), а /rest/v1/rpc/* більше їх не бачить.
-- 2) Двом старим хелперам з 013a закріплюємо search_path.
-- ============================================================================

-- службові функції: не для виклику через API взагалі
REVOKE ALL ON FUNCTION public.audit_row_change()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.class_folder_consistency()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.star_entries_type_bridge()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.class_prizes_given_bridge()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_thresholds_sync()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.class_child_write_guard()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.students_write_guard()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prizes_given_write_guard()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_teacher_limit()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_class_limit()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_class_writable(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_class_public_code()    FROM PUBLIC, anon, authenticated;

-- текстові хелпери: використовуються лише всередині SECURITY DEFINER RPC
REVOKE ALL ON FUNCTION public.normalize_class_code(text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_display_name(text, text)      FROM PUBLIC, anon, authenticated;

-- закріплений search_path для хелперів з 013a (advisor: mutable search_path)
ALTER FUNCTION public.normalize_class_code(text)       SET search_path = public, pg_temp;
ALTER FUNCTION public.student_display_name(text, text) SET search_path = public, pg_temp;

-- Свідомо ЗАЛИШЕНО callable (це і є API-поверхня):
--   anon + authenticated: resolve_class_by_code, public_class_overview,
--     public_student_dashboard (модель Етапу 1);
--   лише authenticated: apply_class_template, reset_student_pin,
--     hard_delete_student, hard_delete_teacher_account (усередині — суворі
--     перевірки auth.uid()).
-- Advisor «Leaked password protection disabled» — налаштування Auth у
-- дашборді, не SQL; занотовано як пункт Етапу 4.
