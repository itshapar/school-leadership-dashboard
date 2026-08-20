-- ============================================================================
-- 030_remove_platform_admin_access.sql
-- Продукт-фідбек Етапу 9: "не треба ніде збирати інформацію про інших
-- вчителів" — /admin/platform (єдиний UI-виклик) прибрано з фронтенду.
--
-- Самі функції лишаються (не чіпаю без потреби), але доступ по REST для
-- будь-якого автентифікованого користувача закриваю — без UI-сторінки цей
-- грант був голою діркою: /rest/v1/rpc/admin_teacher_overview міг викликати
-- будь-хто зі своїм JWT і отримати агреговані дані про ВСІХ вчителів.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.admin_teacher_overview() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_platform_stats()   FROM authenticated;

COMMIT;
