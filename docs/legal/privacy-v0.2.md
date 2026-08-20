# Політика приватності StarBoard — чернетка v0.2

> ⚠️ **Чернетка, до рев'ю юриста.**
>
> Джерело правди для сторінки `/privacy` — `app/privacy/page.tsx`.
> Цей файл — редагована копія для роботи з юристом. Після рев'ю зміни
> переносяться в сторінку разом із підвищенням `TERMS_VERSION`
> у `lib/legal/terms.ts`.

Повний текст розділів у машинному вигляді див. `app/privacy/page.tsx`
(масив `SECTIONS`). Структура:

1. Коротко
2. Хто за що відповідає (контролер/процесор)
3. Дані вчителя
4. Дані учнів
5. Що видно без входу
6. Cookie
7. Де зберігаються дані (Supabase eu-west-1, Vercel fra1)
8. Скільки зберігаємо
9. Кому передаємо
10. Як захищаємо
11. Права
12. Дані дітей
13. Зміни політики
14. Контакти

## Звірено з кодом

Перелік полів у розділах 3–5 звірено зі схемою БД станом на міграцію 025:
`teacher_profiles`, `students`, `star_entries`, `prizes_given`,
`student_sessions`, `student_login_attempts`, `terms_acceptances`.

Твердження «прізвище не залишає кабінет вчителя» спирається на
`public.student_display_name` (міграція 013a) і на те, що публічні RPC
`public_class_overview` / `public_student_dashboard` не віддають `full_name`.
Регресійна перевірка: `scripts/test-fullname-leak.ts`.
