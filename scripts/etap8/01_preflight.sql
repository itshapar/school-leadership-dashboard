-- ============================================================================
-- 01_preflight.sql — Етап 8, крок 1: DRY-RUN. ЖОДНОГО ЗАПИСУ.
--
-- Відповідає на одне питання: чи можна безпечно застосувати 020, яка є
-- ЄДИНОЮ незворотною міграцією проєкту (DROP COLUMN / DROP TYPE).
--
-- Логіка перевірки: 020 дропає легасі-носії даних. Отже, перед нею кожен
-- легасі-носій має бути ПОВНІСТЮ продубльований у новій структурі. Нижче —
-- по одному запиту на кожен носій; будь-який рядок з verdict <> 'OK'
-- означає СТОП.
--
-- Запуск: у Supabase SQL Editor або через MCP execute_sql, блок за блоком.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- A. star_entries.type  →  entry_types (через entry_type_id)
-- ─────────────────────────────────────────────────────────────────────────
select 'A1. записи без нового типу' as check_name,
       count(*)                    as bad_rows,
       case when count(*) = 0 then 'OK' else 'СТОП' end as verdict
from public.star_entries
where entry_type_id is null

union all

select 'A2. тип не збігається з легасі-enum',
       count(*),
       case when count(*) = 0 then 'OK' else 'СТОП' end
from public.star_entries e
join public.entry_types t on t.id = e.entry_type_id
where t.legacy_type is distinct from e.type

union all

-- ─────────────────────────────────────────────────────────────────────────
-- B. classes.game_day_threshold / pizza_day_threshold  →  class_prizes
-- ─────────────────────────────────────────────────────────────────────────
select 'B1. поріг game_day не перенесено',
       count(*),
       case when count(*) = 0 then 'OK' else 'СТОП' end
from public.classes c
where c.game_day_threshold is not null
  and c.game_day_threshold > 0
  and c.game_day_threshold is distinct from (
    select cp.threshold from public.class_prizes cp
    where cp.class_id = c.id and cp.legacy_source = 'game_day' and cp.deleted_at is null)

union all

select 'B2. поріг pizza_day не перенесено',
       count(*),
       case when count(*) = 0 then 'OK' else 'СТОП' end
from public.classes c
where c.pizza_day_threshold is not null
  and c.pizza_day_threshold > 0
  and c.pizza_day_threshold is distinct from (
    select cp.threshold from public.class_prizes cp
    where cp.class_id = c.id and cp.legacy_source = 'pizza_day' and cp.deleted_at is null)

union all

-- ─────────────────────────────────────────────────────────────────────────
-- C. class_prizes_given.prize_type  →  class_prize_id
--    020 робить class_prize_id NOT NULL — рядок без нього завалить міграцію.
-- ─────────────────────────────────────────────────────────────────────────
select 'C1. видача класового призу без призу',
       count(*),
       case when count(*) = 0 then 'OK' else 'СТОП' end
from public.class_prizes_given
where class_prize_id is null

union all

-- ─────────────────────────────────────────────────────────────────────────
-- D. Опора upsert-а журналу, яка ПЕРЕЖИВЕ дроп стовпця type.
--    Без неї автозбереження оцінок почне плодити дублікати (див. 025/025a).
-- ─────────────────────────────────────────────────────────────────────────
select 'D1. індекс star_entries_lesson_slot_uq',
       count(*),
       case when count(*) = 1 then 'OK' else 'СТОП' end
from pg_indexes
where schemaname = 'public' and indexname = 'star_entries_lesson_slot_uq'

union all

select 'D2. індекс НЕ частковий (PostgREST ON CONFLICT)',
       count(*),
       case when count(*) = 0 then 'OK' else 'СТОП' end
from pg_indexes
where schemaname = 'public'
  and indexname = 'star_entries_lesson_slot_uq'
  and indexdef ilike '%WHERE%'

union all

-- ─────────────────────────────────────────────────────────────────────────
-- E. Кожен клас має принаймні один тип, прив'язаний до уроку.
--    Без нього журнал класу стає read-only (клітинки заблоковані).
-- ─────────────────────────────────────────────────────────────────────────
select 'E1. класи без типу для уроку',
       count(*),
       case when count(*) = 0 then 'OK' else 'УВАГА' end
from public.classes c
where c.deleted_at is null
  and not exists (
    select 1 from public.entry_types t
    where t.class_id = c.id and t.is_lesson_bound and t.deleted_at is null)

order by 1;
