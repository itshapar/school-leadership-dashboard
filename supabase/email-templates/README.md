# Листи StarBoard

Три шаблони, які реально розсилає застосунок. Решта слотів у Supabase
(Magic Link, Invite, Reauthentication) не заведені свідомо: у коді немає
ні `signInWithOtp`, ні запрошень, ні реавтентифікації, тож ці листи
надіслати нічим і брендувати нічого.

| Файл | Слот у Supabase | Що його викликає |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `app/register/page.tsx` |
| `reset-password.html` | Reset Password | `app/forgot-password/page.tsx` |
| `change-email.html` | Change Email Address | `components/Admin/ProfileForm.tsx` |

## Як застосувати

Supabase не читає шаблони з репозиторію. Вставляти руками:
Dashboard → Authentication → Email Templates → потрібний слот →
вміст файлу в поле **Message body** → Save.

Тема листа задається там же, поруч:

- Confirm signup: `Підтвердьте email · StarBoard`
- Reset Password: `Новий пароль · StarBoard`
- Change Email Address: `Зміна email · StarBoard`

## Чому не `supabase/config.toml`

Версіонувати шаблони через `config.toml` + `supabase config push` було б
охайніше, але `config push` заливає **весь** файл конфігурації, а не лише
змінені секції: значення, яких у файлі немає, беруться з дефолтів CLI і
перетирають те, що виставлено в дашборді. Під удар потрапляють рівно ті
налаштування, які ми тут і виставляємо руками (Site URL, Redirect URLs,
SMTP, увімкнений Google). Тому шаблони лежать тут як джерело правди для
людини, а не як щось, що застосовується автоматично.

## Чому `{{ .TokenHash }}`, а не `{{ .ConfirmationURL }}`

Дефолтний `{{ .ConfirmationURL }}` у PKCE-режимі (а `createBrowserClient`
за замовчуванням саме PKCE) веде на `?code=`, який прив'язаний до
`code_verifier` у localStorage **того браузера, де починали дію**. Лист,
відкритий на іншому пристрої, мовчки не спрацьовує. Плюс корпоративні
сканери пошти прогрівають посилання і спалюють одноразовий токен ще до
людини.

`{{ .TokenHash }}` такої прив'язки не має і перевіряється лише тоді, коли
сторінку справді відкрили: `verifyOtp` на `/auth/callback` (підтвердження
email і зміна адреси) або на `/reset-password` (скидання пароля).
