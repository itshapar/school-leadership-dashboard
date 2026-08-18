# Як перевірити, що витік закрито

Міграції: `013a_public_codes_and_functions.sql`, `013b_lockdown_anon_and_strict_rls.sql`.

---

## 0. Що саме було відкрито

Роль `anon` (публічний ключ, зашитий у фронтенд і видимий у DevTools кожному
відвідувачу) мала політики `FOR SELECT TO anon USING (true)` на `students`,
`star_entries`, `lessons`, `classes`, `prizes_individual`, `prizes_given`,
`class_prizes_given`. Один HTTP-запит до Supabase REST API повертав повні ПІБ
усіх учнів і всю історію — UI при цьому взагалі не потрібен.

---

## 1. Підготовка

```bash
export SUPABASE_URL="https://glvvsbjkzofswwbzlskt.supabase.co"
export ANON_KEY="<NEXT_PUBLIC_SUPABASE_ANON_KEY зі Vercel / Supabase → Settings → API>"
```

Це саме той ключ, який лежить у бандлі фронтенду. Ніякої «секретності» в ньому
немає — у цьому й суть перевірки.

---

## 2. ДО міграції — переконайся, що витік реальний

> Виконай це **до** застосування 013b, щоб побачити різницю на власні очі.

```bash
curl -s "$SUPABASE_URL/rest/v1/students?select=full_name,nickname&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
```

Очікувано зараз: JSON-масив із реальними ПІБ.

---

## 3. ПІСЛЯ міграції — усі ці запити мають бути порожні / 401

### 3.1. Прямий дамп таблиць

```bash
for t in students classes lessons star_entries prizes_individual prizes_given class_prizes_given; do
  printf '%-20s ' "$t"
  curl -s -o /dev/null -w "HTTP %{http_code}  " \
    "$SUPABASE_URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
  curl -s "$SUPABASE_URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | head -c 120
  echo
done
```

**Очікувано:** `HTTP 401` і тіло виду
`{"code":"42501","message":"permission denied for table students"}` для кожної
таблиці.

Якщо десь побачиш `HTTP 200` і `[]` — це теж прийнятно (політика відсікла
рядки), але означає, що GRANT-и лишились; тоді п.3 міграції 013b не застосувався.
`HTTP 200` з даними = витік НЕ закрито.

### 3.2. Найпростіший тест «одним оком»

```bash
curl -s "$SUPABASE_URL/rest/v1/students?select=full_name" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

Має бути помилка доступу, а не список імен.

### 3.3. Спроба запису анонімом

```bash
curl -s -o /dev/null -w "insert -> HTTP %{http_code}\n" \
  -X POST "$SUPABASE_URL/rest/v1/classes" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"pwned"}'
```

**Очікувано:** `HTTP 401`. (До 013b це могло пройти для класів без `teacher_id`.)

### 3.4. Публічна сторінка класу все ще працює — але тільки через RPC

```bash
CODE="<новий код класу, напр. K7M2PQR9TX — без дефіса>"

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/public_class_overview" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_code\":\"$CODE\"}" | python3 -m json.tool | head -40
```

**Очікувано:** JSON із назвою класу, зірками і списком учнів, де є
`display_name` і **немає** `full_name`.

Швидка перевірка, що ПІБ не витікає:

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/public_class_overview" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"p_code\":\"$CODE\"}" \
  | grep -c "full_name"
```

**Очікувано:** `0`.

### 3.5. Чужий код / перебір нічого не дає

```bash
for c in QQQQQQQQQQ AAAAAAAAAA 0000 9999; do
  printf '%-12s ' "$c"
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/public_class_overview" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" -d "{\"p_code\":\"$c\"}"
  echo
done
```

**Очікувано:** `null` для кожного. Відповідь однакова і для «коду немає», і для
«код невалідний» — щоб перебір не отримував підказок.

### 3.6. Учень з іншого класу за цим кодом не читається

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/public_student_dashboard" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_code\":\"$CODE\",\"p_student_id\":\"11111111-2222-3333-4444-555555555555\"}"
```

**Очікувано:** `null`.

### 3.7. Внутрішні функції недоступні анонімам

```bash
curl -s -o /dev/null -w "resolve_class_by_code -> HTTP %{http_code}\n" \
  -X POST "$SUPABASE_URL/rest/v1/rpc/resolve_class_by_code" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"p_code\":\"$CODE\"}"
```

**Очікувано:** `404` або `401` — але не `200`.

### 3.8. `/dashboard` більше не публічний

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  "https://school-leadership-dashboard.vercel.app/dashboard"
```

**Очікувано:** `307` з редіректом на `/admin/login`.

---

## 4. Перевірка з боку вчителя (нічого не зламалось)

1. Зайди в `/admin` — мають бути видні всі 6 класів, під кожним новий
   «Код для учнів».
2. Відкрий `/admin/<код>` — журнал відкривається, зірки ставляться.
3. Відкрий `/class/<код>` у приватному вікні (без логіну) — сторінка класу
   працює, учні показані нікнеймами/іменами, прізвищ ніде немає.
4. Відкрий `/class/1430` (старий код) — має перекинути на `/class/<новий код>`.

Перевірка в SQL Editor, що безхазяйних класів немає:

```sql
SELECT count(*) FROM classes WHERE teacher_id IS NULL;   -- 0
```

Перевірка, що для anon не лишилось жодної політики й жодного гранта:

```sql
SELECT tablename, policyname, roles::text FROM pg_policies
WHERE schemaname='public' AND roles::text LIKE '%anon%';        -- 0 рядків

SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE grantee='anon' AND table_schema='public';                 -- 0 рядків
```

---

## 5. Що НЕ закрито цією партією (свідомо)

- **Код класу — спільний секрет.** Будь-хто, хто його знає (включно з
  однокласником), бачить сторінку будь-якого учня цього класу: зірки, історію,
  примітки вчителя. Так було й раніше; персональний вхід для учнів — окрема
  задача.
- **Старі 4-значні коди лишаються робочими** як redirect (за твоїм рішенням —
  щоб не ламати роздані посилання). Це залишає простір перебору в 10 000
  варіантів для тих класів, у яких заповнений `legacy_code`. Коли посилання
  будуть оновлені, вимкни їх одним запитом:
  ```sql
  UPDATE classes SET legacy_code = NULL;
  ```
- **Rate limiting на рівні застосунку не налаштований.** Перебір 10-символьних
  кодів нереалістичний (≈49 біт), але для legacy-кодів варто або вимкнути їх,
  або поставити ліміт запитів на `/class/*` (Vercel Firewall / WAF rules).
- **`full_name` лишається в БД** — доступний тільки вчителю-власнику через
  `/admin`. Мінімізація сховища (наприклад, зберігати лише ім'я) — окреме
  рішення, яке треба узгоджувати з тим, як ти ведеш журнал.
