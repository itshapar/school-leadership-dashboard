-- ============================================================================
-- 03_rollback_020.sql — Етап 8: відкат міграції 020 РЕКОНСТРУКЦІЄЮ.
--
-- ⚠️ ЦЕ ДРУГА ЛІНІЯ ОБОРОНИ, А НЕ ПЕРША.
--
-- Первинний відкат — відновлення з бекапу (див. docs/etap8/RUNBOOK.md, крок 2).
-- Він точний і не має обмежень. Але у нього є ціна: він повертає базу на
-- момент бекапу, тобто ВТРАЧАЄ все, що вчителі записали після нього.
--
-- Цей скрипт потрібен для іншого сценарію: 020 застосована, з нею працювали
-- кілька годин, нові бали вже нараховані — і аж тоді знайшлась проблема.
-- Тут відновлення з бекапу коштувало б утрати робочого дня, а реконструкція
-- повертає легасі-структуру, зберігши всі нові дані.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ЩО РЕКОНСТРУЮЄТЬСЯ ТОЧНО:
--   • дані, створені ДО 020 — у них entry_types.legacy_type збережений
--     міграцією 015, тож зіставлення однозначне;
--   • пороги класів — беруться з class_prizes за legacy_source;
--   • структура: enum-типи, стовпці, тригери-містки.
--
-- ЩО РЕКОНСТРУЮЄТЬСЯ НАБЛИЖЕНО (і це треба знати заздалегідь):
--   • нарахування, зроблені ПІСЛЯ 020 типом, який вчитель створив сам
--     («Домашнє завдання», «Олімпіада»), не мають відповідника серед трьох
--     значень старого enum. Для них застосовується те саме правило, яким
--     користувався тригер-місток із 015:
--         sign < 0            → penalty
--         is_lesson_bound     → lesson
--         інакше              → bonus
--     Сума балів і прив'язка до учня НЕ страждають — приблизним стає лише
--     легасі-ярлик `type`, який після 020 нікому не потрібен.
--   • класові призи, створені після 020, отримають legacy_source = NULL;
--     старий фронтенд їх просто не побачить, дані лишаться на місці.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Порядок повного відкату:
--   1) цей скрипт;
--   2) повторно застосувати supabase/migrations/019_limits_and_public_rpc.sql
--      — він написаний ідемпотентно (CREATE OR REPLACE / DROP … IF EXISTS)
--      і поверне версії public_class_overview та public_student_dashboard
--      зі старими ключами (game_day_threshold, pizza_day_threshold, type);
--   3) відкотити деплой фронтенду на попередній production-деплой у Vercel.
--
-- Скрипт ідемпотентний: повторний запуск нічого не зіпсує.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enum-типи
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'star_type' AND n.nspname = 'public') THEN
    CREATE TYPE public.star_type AS ENUM ('lesson', 'bonus', 'penalty');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'class_prize_type' AND n.nspname = 'public') THEN
    CREATE TYPE public.class_prize_type AS ENUM ('game_day', 'pizza_day');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. entry_types.legacy_type — ярлик, від якого залежить решта реконструкції
-- ---------------------------------------------------------------------------
ALTER TABLE public.entry_types
  ADD COLUMN IF NOT EXISTS legacy_type public.star_type;

UPDATE public.entry_types t
SET legacy_type = CASE
    -- Спершу — точне зіставлення за назвами системного шаблону (017).
    WHEN lower(btrim(t.name)) = 'урок'  THEN 'lesson'::public.star_type
    WHEN lower(btrim(t.name)) = 'бонус' THEN 'bonus'::public.star_type
    WHEN lower(btrim(t.name)) = 'штраф' THEN 'penalty'::public.star_type
    -- Далі — те саме правило, що в тригері-містку з 015.
    WHEN t.sign < 0                     THEN 'penalty'::public.star_type
    WHEN t.is_lesson_bound              THEN 'lesson'::public.star_type
    ELSE                                     'bonus'::public.star_type
  END
WHERE t.legacy_type IS NULL;

-- Індекс із 015: максимум один тип на кожне enum-значення в класі.
-- Створюємо ТІЛЬКИ якщо дублікатів немає — інакше він завалить скрипт.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.entry_types
    WHERE legacy_type IS NOT NULL
    GROUP BY class_id, legacy_type HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS entry_types_legacy_uq
      ON public.entry_types (class_id, legacy_type) WHERE legacy_type IS NOT NULL;
  ELSE
    RAISE NOTICE 'entry_types_legacy_uq пропущено: у класі є кілька типів з тим самим легасі-ярликом (нормально, якщо після 020 створювали власні типи)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. star_entries.type
-- ---------------------------------------------------------------------------
ALTER TABLE public.star_entries
  ADD COLUMN IF NOT EXISTS type public.star_type;

UPDATE public.star_entries e
SET type = t.legacy_type
FROM public.entry_types t
WHERE t.id = e.entry_type_id AND e.type IS NULL;

ALTER TABLE public.star_entries ALTER COLUMN type SET NOT NULL;

-- Констрейнт із 006 — опора upsert-а СТАРОГО фронтенду.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'unique_student_lesson_type_star') THEN
    ALTER TABLE public.star_entries
      ADD CONSTRAINT unique_student_lesson_type_star
      UNIQUE (student_id, lesson_id, type);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Класові призи
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_prizes
  ADD COLUMN IF NOT EXISTS legacy_source public.class_prize_type;

UPDATE public.class_prizes p
SET legacy_source = CASE
    WHEN lower(btrim(p.name)) = 'game day'  THEN 'game_day'::public.class_prize_type
    WHEN lower(btrim(p.name)) = 'pizza day' THEN 'pizza_day'::public.class_prize_type
    ELSE NULL   -- приз, створений після 020: легасі-відповідника немає
  END
WHERE p.legacy_source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS class_prizes_legacy_uq
  ON public.class_prizes (class_id, legacy_source) WHERE legacy_source IS NOT NULL;

ALTER TABLE public.class_prizes_given
  ADD COLUMN IF NOT EXISTS prize_type public.class_prize_type;

UPDATE public.class_prizes_given g
SET prize_type = p.legacy_source
FROM public.class_prizes p
WHERE p.id = g.class_prize_id AND g.prize_type IS NULL;

-- До 020 class_prize_id був nullable — повертаємо як було.
ALTER TABLE public.class_prizes_given ALTER COLUMN class_prize_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Пороги класів
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS game_day_threshold  int,
  ADD COLUMN IF NOT EXISTS pizza_day_threshold int;

UPDATE public.classes c
SET game_day_threshold = coalesce((
      SELECT p.threshold FROM public.class_prizes p
      WHERE p.class_id = c.id AND p.legacy_source = 'game_day' AND p.deleted_at IS NULL
    ), c.game_day_threshold, 250),
    pizza_day_threshold = coalesce((
      SELECT p.threshold FROM public.class_prizes p
      WHERE p.class_id = c.id AND p.legacy_source = 'pizza_day' AND p.deleted_at IS NULL
    ), c.pizza_day_threshold, 500);

-- ---------------------------------------------------------------------------
-- 6. Тригери-містки (дослівно з 015 і 016)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.star_entries_type_bridge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_type public.entry_types%ROWTYPE;
BEGIN
  IF NEW.entry_type_id IS NULL THEN
    SELECT * INTO v_type
    FROM public.entry_types t
    WHERE t.class_id = NEW.class_id AND t.legacy_type = NEW.type
      AND t.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Немає типу нарахування для %', NEW.type;
    END IF;
    NEW.entry_type_id := v_type.id;
  ELSE
    SELECT * INTO v_type FROM public.entry_types t WHERE t.id = NEW.entry_type_id;
    NEW.type := coalesce(
      v_type.legacy_type,
      CASE WHEN v_type.sign < 0 THEN 'penalty'::public.star_type
           WHEN v_type.is_lesson_bound THEN 'lesson'::public.star_type
           ELSE 'bonus'::public.star_type END);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS star_entries_type_bridge_trg ON public.star_entries;
CREATE TRIGGER star_entries_type_bridge_trg
  BEFORE INSERT OR UPDATE OF type, entry_type_id ON public.star_entries
  FOR EACH ROW EXECUTE FUNCTION public.star_entries_type_bridge();

CREATE OR REPLACE FUNCTION public.class_prizes_given_bridge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.class_prize_id IS NULL AND NEW.prize_type IS NOT NULL THEN
    SELECT p.id INTO NEW.class_prize_id
    FROM public.class_prizes p
    WHERE p.class_id = NEW.class_id AND p.legacy_source = NEW.prize_type
      AND p.deleted_at IS NULL;
    IF NEW.class_prize_id IS NULL THEN
      RAISE EXCEPTION 'Немає класового призу для %', NEW.prize_type;
    END IF;
  ELSIF NEW.class_prize_id IS NOT NULL AND NEW.prize_type IS NULL THEN
    SELECT p.legacy_source INTO NEW.prize_type
    FROM public.class_prizes p WHERE p.id = NEW.class_prize_id;
  END IF;
  IF NEW.class_prize_id IS NULL THEN
    RAISE EXCEPTION 'Видача класового призу без призу';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS class_prizes_given_bridge_trg ON public.class_prizes_given;
CREATE TRIGGER class_prizes_given_bridge_trg
  BEFORE INSERT OR UPDATE OF prize_type, class_prize_id ON public.class_prizes_given
  FOR EACH ROW EXECUTE FUNCTION public.class_prizes_given_bridge();

CREATE OR REPLACE FUNCTION public.legacy_thresholds_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.game_day_threshold IS DISTINCT FROM OLD.game_day_threshold THEN
    UPDATE public.class_prizes SET threshold = NEW.game_day_threshold
    WHERE class_id = NEW.id AND legacy_source = 'game_day'
      AND threshold IS DISTINCT FROM NEW.game_day_threshold;
  END IF;
  IF NEW.pizza_day_threshold IS DISTINCT FROM OLD.pizza_day_threshold THEN
    UPDATE public.class_prizes SET threshold = NEW.pizza_day_threshold
    WHERE class_id = NEW.id AND legacy_source = 'pizza_day'
      AND threshold IS DISTINCT FROM NEW.pizza_day_threshold;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS legacy_thresholds_sync_trg ON public.classes;
CREATE TRIGGER legacy_thresholds_sync_trg
  AFTER UPDATE OF game_day_threshold, pizza_day_threshold ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.legacy_thresholds_sync();

COMMIT;

-- ============================================================================
-- ПІСЛЯ ЦЬОГО СКРИПТА:
--   1) повторно застосувати 019_limits_and_public_rpc.sql (повертає RPC
--      зі старими ключами);
--   2) відкотити деплой фронтенду у Vercel на попередній production-деплой;
--   3) звірити дані:  npx tsx scripts/etap8/snapshot.ts after
--
-- Контрольний запит — чи всі записи отримали легасі-ярлик:
--   select count(*) from public.star_entries where type is null;   -- має бути 0
-- ============================================================================
