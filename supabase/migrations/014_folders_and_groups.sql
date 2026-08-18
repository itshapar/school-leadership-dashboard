-- ============================================================================
-- 014_folders_and_groups.sql
-- Етап 3 (мультивчительська схема) · Фаза A (адитивна) · файл 1/6
--
-- Ієрархія-«папки»: школи → паралелі (обидві ОПЦІОНАЛЬНІ, особисті для
-- вчителя, без спільних даних) + групи всередині класу.
-- Нічого не ламає для задеплоєного коду: лише додає обʼєкти.
--
-- Передумова: фактичний стан прода після 013b (anon: 0 політик, 0 грантів,
-- default privileges для anon відкликані; event-тригер rls_auto_enable
-- автоматично вмикає RLS на нових таблицях — ми все одно вмикаємо явно).
--
-- Ключовий прийом: крос-вчительська цілісність тримається на КОМПОЗИТНИХ FK
-- (school_id, teacher_id) → schools(id, teacher_id) тощо. RLS гарантує
-- teacher_id = auth.uid(), а композитний FK гарантує, що вказана папка
-- належить ТОМУ Ж вчителю. Декларативно, без тригерів, які можна забути.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. classes.teacher_id → NOT NULL.
-- Після Етапу 1 безхазяйних класів не існує (auto-claim видалено, на проді
-- перевірено: 0 рядків із NULL). Володіння призначається при створенні класу.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes ALTER COLUMN teacher_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Школи — опціональна папка верхнього рівня.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  sort_order  int  NOT NULL DEFAULT 0,
  deleted_at  timestamptz,                      -- soft delete
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id)                        -- опора для композитних FK
);

-- Унікальність назви серед не видалених (регістронезалежно).
CREATE UNIQUE INDEX IF NOT EXISTS schools_name_uq
  ON public.schools (teacher_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS schools_teacher_idx ON public.schools (teacher_id);

-- ---------------------------------------------------------------------------
-- 2. Паралелі — опціональна папка другого рівня.
-- Паралель МОЖЕ існувати без школи (кейс Andrew: паралель «7» без школи).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parallels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid,                              -- NULL = поза школою
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  sort_order  int  NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id),
  -- школа, якщо вказана, мусить належати тому ж вчителю; при фізичному
  -- видаленні школи паралель лишається, лише відвʼязується (PG15+: SET NULL
  -- на вказаному стовпці, teacher_id не зачіпається)
  FOREIGN KEY (school_id, teacher_id)
    REFERENCES public.schools (id, teacher_id)
    ON DELETE SET NULL (school_id)
);

-- Назва унікальна в межах (вчитель, школа-або-без-школи).
CREATE UNIQUE INDEX IF NOT EXISTS parallels_name_uq
  ON public.parallels (teacher_id,
                       coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
                       lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS parallels_teacher_idx ON public.parallels (teacher_id);
CREATE INDEX IF NOT EXISTS parallels_school_idx  ON public.parallels (school_id);

-- ---------------------------------------------------------------------------
-- 3. Класи отримують опціональні привʼязки до папок.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS school_id   uuid,
  ADD COLUMN IF NOT EXISTS parallel_id uuid;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_school_same_teacher_fk;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_school_same_teacher_fk
  FOREIGN KEY (school_id, teacher_id)
  REFERENCES public.schools (id, teacher_id)
  ON DELETE SET NULL (school_id);

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_parallel_same_teacher_fk;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_parallel_same_teacher_fk
  FOREIGN KEY (parallel_id, teacher_id)
  REFERENCES public.parallels (id, teacher_id)
  ON DELETE SET NULL (parallel_id);

CREATE INDEX IF NOT EXISTS classes_school_idx   ON public.classes (school_id);
CREATE INDEX IF NOT EXISTS classes_parallel_idx ON public.classes (parallel_id);

-- Узгодженість школа/паралель: якщо клас у паралелі, що належить школі,
-- школа класу автозаповнюється і не може суперечити школі паралелі.
CREATE OR REPLACE FUNCTION public.class_folder_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_parallel_school uuid;
BEGIN
  IF NEW.parallel_id IS NOT NULL THEN
    SELECT p.school_id INTO v_parallel_school
    FROM public.parallels p WHERE p.id = NEW.parallel_id;

    IF v_parallel_school IS NOT NULL THEN
      IF NEW.school_id IS NULL THEN
        NEW.school_id := v_parallel_school;              -- автовивід школи
      ELSIF NEW.school_id <> v_parallel_school THEN
        RAISE EXCEPTION 'Паралель належить іншій школі, ніж вказана для класу';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_folder_consistency_trg ON public.classes;
CREATE TRIGGER class_folder_consistency_trg
  BEFORE INSERT OR UPDATE OF school_id, parallel_id ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.class_folder_consistency();

-- ---------------------------------------------------------------------------
-- 4. Групи всередині класу (опціональні; учень належить ≤ 1 групі СВОГО класу).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  sort_order  int  NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, class_id)                          -- опора для композитних FK
);

CREATE UNIQUE INDEX IF NOT EXISTS class_groups_name_uq
  ON public.class_groups (class_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS class_groups_class_idx ON public.class_groups (class_id);

-- «≤ 1 групи» — скалярний стовпець; «свого класу» — композитний FK.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS group_id uuid;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_group_same_class_fk;
ALTER TABLE public.students
  ADD CONSTRAINT students_group_same_class_fk
  FOREIGN KEY (group_id, class_id)
  REFERENCES public.class_groups (id, class_id)
  ON DELETE SET NULL (group_id);

CREATE INDEX IF NOT EXISTS students_group_idx ON public.students (group_id);

-- ---------------------------------------------------------------------------
-- 5. RLS: нові таблиці — окремі політики SELECT/INSERT/UPDATE/DELETE
--    з WITH CHECK, строго teacher_id = auth.uid() (напряму або ланцюжком
--    до класу). Anon: нуль політик, нуль грантів (посилюємо явно).
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parallels    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.schools, public.parallels, public.class_groups FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.schools, public.parallels, public.class_groups TO authenticated;

-- schools: власний teacher_id
DROP POLICY IF EXISTS schools_select_own ON public.schools;
CREATE POLICY schools_select_own ON public.schools FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS schools_insert_own ON public.schools;
CREATE POLICY schools_insert_own ON public.schools FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS schools_update_own ON public.schools;
CREATE POLICY schools_update_own ON public.schools FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS schools_delete_own ON public.schools;
CREATE POLICY schools_delete_own ON public.schools FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- parallels: власний teacher_id
DROP POLICY IF EXISTS parallels_select_own ON public.parallels;
CREATE POLICY parallels_select_own ON public.parallels FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS parallels_insert_own ON public.parallels;
CREATE POLICY parallels_insert_own ON public.parallels FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS parallels_update_own ON public.parallels;
CREATE POLICY parallels_update_own ON public.parallels FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS parallels_delete_own ON public.parallels;
CREATE POLICY parallels_delete_own ON public.parallels FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- class_groups: ланцюжок до класу
DROP POLICY IF EXISTS class_groups_select_own ON public.class_groups;
CREATE POLICY class_groups_select_own ON public.class_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_groups.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_groups_insert_own ON public.class_groups;
CREATE POLICY class_groups_insert_own ON public.class_groups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = class_groups.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_groups_update_own ON public.class_groups;
CREATE POLICY class_groups_update_own ON public.class_groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_groups.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c
                      WHERE c.id = class_groups.class_id AND c.teacher_id = auth.uid()));
DROP POLICY IF EXISTS class_groups_delete_own ON public.class_groups;
CREATE POLICY class_groups_delete_own ON public.class_groups FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c
                 WHERE c.id = class_groups.class_id AND c.teacher_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Дані Andrew: паралель «7» (без школи) + привʼязка його 6 класів.
--    Ідемпотентно; підтверджено власником 2026-08-18.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_teacher  uuid := '037e7f5f-0f0b-454c-b041-601d2f27eb2a';
  v_parallel uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.classes WHERE teacher_id = v_teacher) THEN
    SELECT id INTO v_parallel
    FROM public.parallels
    WHERE teacher_id = v_teacher AND school_id IS NULL
      AND lower(name) = '7' AND deleted_at IS NULL;

    IF v_parallel IS NULL THEN
      INSERT INTO public.parallels (teacher_id, name, sort_order)
      VALUES (v_teacher, '7', 1)
      RETURNING id INTO v_parallel;
    END IF;

    UPDATE public.classes
    SET parallel_id = v_parallel
    WHERE teacher_id = v_teacher AND parallel_id IS NULL;
  END IF;
END $$;
