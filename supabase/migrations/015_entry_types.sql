-- ============================================================================
-- 015_entry_types.sql
-- Етап 3 · Фаза A (адитивна) · файл 2/6
--
-- Гнучка система балів: таблиця типів нарахувань НА РІВНІ КЛАСУ замість
-- зашитого enum star_type (lesson/bonus/penalty).
--
-- Факти з прода, на які спирається backfill (звірено 2026-08-18):
--   • type='lesson': 1321 рядок, amount від −1 до +3 (210 рядків з −1!);
--   • type='bonus' :   53 рядки, amount +1..+6, всі без lesson_id;
--   • type='penalty': 0 рядків — НЕ використовується.
-- Висновок: знак типу (sign) — це DEFAULT-підказка для UI, а НЕ CHECK на
-- записи. Джерело правди — amount самого запису; інакше 210 легальних
-- рядків «Урок з −1» не переживуть міграцію.
--
-- Старий стовпець star_entries.type НЕ чіпаємо (задеплоєний фронтенд на
-- нього дивиться). Міст старе↔нове — тригер нижче. Drop — у 020 (Фаза B).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Типи нарахувань.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entry_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  sign            smallint NOT NULL DEFAULT 1 CHECK (sign IN (1, -1)),
  default_amount  int  NOT NULL DEFAULT 1 CHECK (default_amount BETWEEN 1 AND 100),
  is_lesson_bound boolean NOT NULL DEFAULT false,
  icon            text CHECK (icon IS NULL OR length(icon) <= 16),
  color           text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order      int  NOT NULL DEFAULT 0,
  legacy_type     public.star_type,   -- ТИМЧАСОВИЙ місток до enum; drop у 020
  deleted_at      timestamptz,        -- типи з записами лише soft-delete
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, class_id)               -- опора для композитного FK нижче
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_types_name_uq
  ON public.entry_types (class_id, lower(name)) WHERE deleted_at IS NULL;
-- максимум один тип на кожне enum-значення в класі (детермінований місток)
CREATE UNIQUE INDEX IF NOT EXISTS entry_types_legacy_uq
  ON public.entry_types (class_id, legacy_type) WHERE legacy_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS entry_types_class_idx ON public.entry_types (class_id);

-- ---------------------------------------------------------------------------
-- 2. Нові стовпці star_entries.
--    Модель нарахувань групі/класу: FAN-OUT — 1 рядок на учня (як зараз усі
--    1374 рядки). scope/group_id/batch_id зберігають провенанс масової
--    операції і дають дешеве масове скасування за batch_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.star_entries
  ADD COLUMN IF NOT EXISTS entry_type_id uuid,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'student'
    CHECK (scope IN ('student', 'group', 'class')),
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- тип мусить належати ТОМУ Ж класу, що й запис (композитний FK)
ALTER TABLE public.star_entries DROP CONSTRAINT IF EXISTS star_entries_type_same_class_fk;
ALTER TABLE public.star_entries
  ADD CONSTRAINT star_entries_type_same_class_fk
  FOREIGN KEY (entry_type_id, class_id)
  REFERENCES public.entry_types (id, class_id);
  -- ON DELETE за замовчуванням NO ACTION: тип із записами фізично не
  -- видаляється (лише deleted_at) — історія завжди роздільна.

-- група (якщо була) мусить належати тому ж класу
ALTER TABLE public.star_entries DROP CONSTRAINT IF EXISTS star_entries_group_same_class_fk;
ALTER TABLE public.star_entries
  ADD CONSTRAINT star_entries_group_same_class_fk
  FOREIGN KEY (group_id, class_id)
  REFERENCES public.class_groups (id, class_id)
  ON DELETE SET NULL (group_id);

CREATE INDEX IF NOT EXISTS star_entries_type_idx  ON public.star_entries (entry_type_id);
CREATE INDEX IF NOT EXISTS star_entries_batch_idx ON public.star_entries (batch_id)
  WHERE batch_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill: три типи з шаблона автора в КОЖЕН наявний клас.
-- ---------------------------------------------------------------------------
INSERT INTO public.entry_types
  (class_id, name, sign, default_amount, is_lesson_bound, icon, sort_order, legacy_type)
SELECT c.id, t.name, t.sign, t.default_amount, t.is_lesson_bound, t.icon, t.sort_order, t.legacy_type
FROM public.classes c
CROSS JOIN (VALUES
  ('Урок',   1, 1, true,  '⭐', 1, 'lesson'::public.star_type),
  ('Бонус',  1, 1, false, '🎁', 2, 'bonus'::public.star_type),
  ('Штраф', -1, 1, false, '⚡', 3, 'penalty'::public.star_type)
) AS t(name, sign, default_amount, is_lesson_bound, icon, sort_order, legacy_type)
ON CONFLICT (class_id, legacy_type) WHERE legacy_type IS NOT NULL DO NOTHING;

-- Мапінг наявних записів: lesson→Урок, bonus→Бонус, penalty→Штраф.
-- Amount НЕ чіпаємо — 210 рядків «Урок −1» переносяться як є, без втрат.
UPDATE public.star_entries e
SET entry_type_id = t.id
FROM public.entry_types t
WHERE e.entry_type_id IS NULL
  AND t.class_id = e.class_id
  AND t.legacy_type = e.type;

-- Після backfill жодного рядка без типу бути не може.
ALTER TABLE public.star_entries ALTER COLUMN entry_type_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Місток на перехідний період (до деплою нового фронтенду + 020):
--    • старий код пише лише type  → тригер знаходить entry_type_id;
--    • новий код пише entry_type_id → тригер тримає type консистентним.
-- SECURITY INVOKER: authenticated читає entry_types через RLS (бачить лише
-- свої), service_role (імпорт) обходить RLS штатно, anon не пише взагалі.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.star_entries_type_bridge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_type public.entry_types%ROWTYPE;
BEGIN
  IF NEW.entry_type_id IS NULL THEN
    -- шлях старого коду
    SELECT * INTO v_type
    FROM public.entry_types t
    WHERE t.class_id = NEW.class_id AND t.legacy_type = NEW.type
      AND t.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Немає типу нарахування для %', NEW.type;
    END IF;
    NEW.entry_type_id := v_type.id;
  ELSE
    -- шлях нового коду: enum-стовпець тримаємо валідним до 020
    SELECT * INTO v_type FROM public.entry_types t WHERE t.id = NEW.entry_type_id;
    NEW.type := coalesce(
      v_type.legacy_type,
      CASE WHEN v_type.sign < 0 THEN 'penalty'::public.star_type
           WHEN v_type.is_lesson_bound THEN 'lesson'::public.star_type
           ELSE 'bonus'::public.star_type END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS star_entries_type_bridge_trg ON public.star_entries;
CREATE TRIGGER star_entries_type_bridge_trg
  BEFORE INSERT OR UPDATE OF type, entry_type_id ON public.star_entries
  FOR EACH ROW EXECUTE FUNCTION public.star_entries_type_bridge();

-- ---------------------------------------------------------------------------
-- 5. RLS для entry_types: ланцюжок до класу, 4 окремі політики + WITH CHECK.
-- ---------------------------------------------------------------------------
ALTER TABLE public.entry_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entry_types FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_types TO authenticated;

DROP POLICY IF EXISTS entry_types_select_own ON public.entry_types;
CREATE POLICY entry_types_select_own ON public.entry_types FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = entry_types.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS entry_types_insert_own ON public.entry_types;
CREATE POLICY entry_types_insert_own ON public.entry_types FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = entry_types.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS entry_types_update_own ON public.entry_types;
CREATE POLICY entry_types_update_own ON public.entry_types FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = entry_types.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = entry_types.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS entry_types_delete_own ON public.entry_types;
CREATE POLICY entry_types_delete_own ON public.entry_types FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = entry_types.class_id AND c.teacher_id = auth.uid()));
