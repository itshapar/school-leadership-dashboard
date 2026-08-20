# Крок 2: бекап перед 020

`020` — єдина незворотна міграція проєкту. Бекап обов'язковий.

## Варіант A — Supabase (рекомендований)

Проєкт `School Leadership Dashboard` (`glvvsbjkzofswwbzlskt`), план визначає,
що саме доступно:

1. **Dashboard → Database → Backups.** На платних планах є Point-in-Time
   Recovery: достатньо **записати UTC-час перед запуском 020** — відкат
   робиться на будь-яку секунду до нього.
2. Якщо PITR недоступний — там же кнопка створення бекапу на вимогу.
   Дочекайся статусу «completed» ДО застосування 020.

Запиши в `docs/etap8/RUNBOOK.md` фактичний час і тип бекапу.

## Варіант B — pg_dump (локальна копія)

Connection string: Dashboard → Project Settings → Database → Connection string
(режим **Session**, не Transaction — `pg_dump` не працює через pooler).

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.glvvsbjkzofswwbzlskt.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges \
  -f "backup-before-020-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

Перевір, що дамп не порожній і містить дані:

```bash
grep -c "COPY public.star_entries" backup-before-020-*.sql   # має бути 1
```

> ⚠️ Дамп містить **прізвища та імена всіх учнів**. Не клади його в
> репозиторій і не заливай у хмарні диски. Локально, і видалити після
> успішної перевірки.

## Що бекап НЕ покриває

Відновлення з бекапу повертає базу на момент зняття — тобто **втрачає все,
що вчителі записали після нього**. Для сценарію «проблему знайшли за кілька
годин роботи» є другий шлях: `scripts/etap8/03_rollback_020.sql`, який
відновлює легасі-структуру реконструкцією, зберігши нові дані.
