-- ============================================================================
-- 016_class_prizes.sql
-- Етап 3 · Фаза A (адитивна) · файл 3/6
--
-- Класові призи як конфігуровані рядки замість двох зашитих стовпців
-- classes.game_day_threshold / pizza_day_threshold (+ enum class_prize_type).
--
-- Факти з прода: пороги РІЗНІ по класах (напр., 7В: 100/200, 7Б: 250/500) —
-- тому міграція переносить фактичні значення кожного класу, а не дефолти.
-- class_prizes_given на проді порожня (0 рядків) — backfill тривіальний.
--
-- Старі стовпці/enum лишаються до 020 (Фаза B); на час переходу працює
-- односторонній sync: старий UI редагує classes.*_threshold → тригер
-- оновлює class_prizes. Новий UI пише ЛИШЕ в class_prizes (джерело правди).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Класові призи.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_prizes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  emoji         text NOT NULL DEFAULT '🏆' CHECK (length(emoji) <= 16),
  threshold     int  NOT NULL CHECK (threshold > 0),   -- поріг сумарних зірок класу
  sort_order    int  NOT NULL DEFAULT 0,
  legacy_source public.class_prize_type,  -- ТИМЧАСОВИЙ місток game_day/pizza_day; drop у 020
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, class_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS class_prizes_name_uq
  ON public.class_prizes (class_id, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS class_prizes_legacy_uq
  ON public.class_prizes (class_id, legacy_source) WHERE legacy_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS class_prizes_class_idx ON public.class_prizes (class_id);

-- ---------------------------------------------------------------------------
-- 2. Перенесення фактичних порогів кожного класу.
-- ---------------------------------------------------------------------------
INSERT INTO public.class_prizes (class_id, name, emoji, threshold, sort_order, legacy_source)
SELECT c.id, 'Game day', '🎮', c.game_day_threshold, 1, 'game_day'::public.class_prize_type
FROM public.classes c
WHERE c.game_day_threshold IS NOT NULL AND c.game_day_threshold > 0
UNION ALL
SELECT c.id, 'Pizza day', '🍕', c.pizza_day_threshold, 2, 'pizza_day'::public.class_prize_type
FROM public.classes c
WHERE c.pizza_day_threshold IS NOT NULL AND c.pizza_day_threshold > 0
ON CONFLICT (class_id, legacy_source) WHERE legacy_source IS NOT NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. class_prizes_given → посилання на конкретний приз.
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_prizes_given
  ADD COLUMN IF NOT EXISTS class_prize_id uuid;

ALTER TABLE public.class_prizes_given DROP CONSTRAINT IF EXISTS class_prizes_given_prize_same_class_fk;
ALTER TABLE public.class_prizes_given
  ADD CONSTRAINT class_prizes_given_prize_same_class_fk
  FOREIGN KEY (class_prize_id, class_id)
  REFERENCES public.class_prizes (id, class_id);

-- backfill наявних видач (на проді 0 рядків, але міграція самодостатня)
UPDATE public.class_prizes_given g
SET class_prize_id = p.id
FROM public.class_prizes p
WHERE g.class_prize_id IS NULL
  AND p.class_id = g.class_id
  AND p.legacy_source = g.prize_type;

-- Дозволяємо кастомні класові призи: enum-стовпець стає nullable.
-- Старий код завжди його заповнює — його це не зачіпає; рядки нових
-- (кастомних) призів матимуть prize_type = NULL до 020.
ALTER TABLE public.class_prizes_given ALTER COLUMN prize_type DROP NOT NULL;

-- Місток для перехідного періоду: старий код пише лише prize_type.
CREATE OR REPLACE FUNCTION public.class_prizes_given_bridge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;

DROP TRIGGER IF EXISTS class_prizes_given_bridge_trg ON public.class_prizes_given;
CREATE TRIGGER class_prizes_given_bridge_trg
  BEFORE INSERT OR UPDATE OF prize_type, class_prize_id ON public.class_prizes_given
  FOR EACH ROW EXECUTE FUNCTION public.class_prizes_given_bridge();

-- ---------------------------------------------------------------------------
-- 4. Односторонній sync на перехідний період: старий UI редагує
--    classes.game_day_threshold / pizza_day_threshold → оновлюємо class_prizes.
--    (Тригер видаляється у 020 разом зі старими стовпцями.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_thresholds_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.game_day_threshold IS DISTINCT FROM OLD.game_day_threshold THEN
    UPDATE public.class_prizes
    SET threshold = NEW.game_day_threshold
    WHERE class_id = NEW.id AND legacy_source = 'game_day'
      AND threshold IS DISTINCT FROM NEW.game_day_threshold;
  END IF;
  IF NEW.pizza_day_threshold IS DISTINCT FROM OLD.pizza_day_threshold THEN
    UPDATE public.class_prizes
    SET threshold = NEW.pizza_day_threshold
    WHERE class_id = NEW.id AND legacy_source = 'pizza_day'
      AND threshold IS DISTINCT FROM NEW.pizza_day_threshold;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legacy_thresholds_sync_trg ON public.classes;
CREATE TRIGGER legacy_thresholds_sync_trg
  AFTER UPDATE OF game_day_threshold, pizza_day_threshold ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.legacy_thresholds_sync();

-- ---------------------------------------------------------------------------
-- 5. RLS для class_prizes (ланцюжок до класу, 4 політики + WITH CHECK).
--    Політики class_prizes_given перебудовуються у 019 разом з рештою
--    наявних таблиць.
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_prizes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_prizes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_prizes TO authenticated;

DROP POLICY IF EXISTS class_prizes_select_own ON public.class_prizes;
CREATE POLICY class_prizes_select_own ON public.class_prizes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_prizes.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_prizes_insert_own ON public.class_prizes;
CREATE POLICY class_prizes_insert_own ON public.class_prizes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = class_prizes.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_prizes_update_own ON public.class_prizes;
CREATE POLICY class_prizes_update_own ON public.class_prizes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_prizes.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = class_prizes.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_prizes_delete_own ON public.class_prizes;
CREATE POLICY class_prizes_delete_own ON public.class_prizes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_prizes.class_id AND c.teacher_id = auth.uid()));
