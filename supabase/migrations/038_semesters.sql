-- ============================================================================
-- 038_semesters.sql
-- Етап 10 · Семестри й перехід класу в новий семестр.
--
-- Програма нагород розрахована рівно на ОДИН семестр: чіткий період, у якому
-- діти заробляють бали й обмінюють їх на призи. До цієї міграції такого
-- поняття в базі не було взагалі — клас жив вічно, а бали накопичувались
-- нескінченно, і на межі семестрів учитель не мав що з цим робити.
--
-- Модель (рішення Andrew, 2026-08-25): семестр — це КОНТЕЙНЕР КЛАСІВ, як
-- паралель, плюс діапазон дат. Один клас = один семестр. Коли 7-А стає 8-А,
-- створюється НОВИЙ рядок classes у новому семестрі, а старий лишається
-- цілим як історія. Це працює саме тому, що вся модель уже прив'язана до
-- class_id: бали, уроки, призи, типи нарахувань. Новий клас автоматично
-- стартує з нуля, і жоден наявний запит не треба переписувати.
--
-- Альтернативу (один клас + фільтр за датами в кожному запиті, включно з
-- SECURITY DEFINER RPC учнівського дашборду) свідомо відкинули: вона
-- розповзається по всьому коду і показує історію старого семестру під
-- новою назвою класу.
--
-- Що переноситься майстром переходу: ПІБ, нікнейми, аватарки, групи, типи
-- нарахувань, нагороди, PIN-и й сам код класу (для дітей не змінюється
-- нічого — той самий код, той самий PIN). Що НЕ переноситься: бали, уроки,
-- видані призи — заради цього все й робиться.
--
-- Старий клас після переходу — АРХІВ, тільки для читання. Це не UI-умовність:
-- заборона запису в дочірні таблиці архівного класу стоїть тригерами з
-- міграції 018, тож нарахувати бал чи видати приз у завершеному семестрі
-- неможливо навіть в обхід застосунку. Досі цей механізм просто не мав за
-- чим стежити — тепер архів означає рівно одне: семестр завершено.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Таблиця семестрів. Той самий каркас, що в schools/parallels (014):
--    teacher_id NOT NULL, soft delete, UNIQUE (id, teacher_id) як опора для
--    композитного FK — клас не може посилатись на чужий семестр.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.semesters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT semesters_range_ck CHECK (ends_on >= starts_on),
  UNIQUE (id, teacher_id)
);

-- Назви не повторюються в межах учителя: «I семестр 2025/2026» має бути один.
-- Перекриття дат НЕ забороняємо — учитель може вести паралельно річний і
-- семестровий період, це його справа (рішення Andrew: «я не обмежуватиму
-- людей»); поточний семестр обирається детерміновано в lib/admin/semesters.ts.
CREATE UNIQUE INDEX IF NOT EXISTS semesters_name_uq
  ON public.semesters (teacher_id, lower(btrim(name))) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS semesters_teacher_idx
  ON public.semesters (teacher_id, starts_on DESC);

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.semesters FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semesters TO authenticated;

DROP POLICY IF EXISTS semesters_select_own ON public.semesters;
CREATE POLICY semesters_select_own ON public.semesters FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS semesters_insert_own ON public.semesters;
CREATE POLICY semesters_insert_own ON public.semesters FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS semesters_update_own ON public.semesters;
CREATE POLICY semesters_update_own ON public.semesters FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS semesters_delete_own ON public.semesters;
CREATE POLICY semesters_delete_own ON public.semesters FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- Ліміт на акаунт — той самий механізм, що для класів/паралелей (019).
-- 20 семестрів це 10 років роботи; межа існує проти абузу відкритої
-- реєстрації, а не проти вчителя.
DROP TRIGGER IF EXISTS limit_trg ON public.semesters;
CREATE TRIGGER limit_trg BEFORE INSERT OR UPDATE OF deleted_at ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_limit('20');

-- ---------------------------------------------------------------------------
-- 2. Клас отримує семестр і «походження» — з якого класу його перенесли.
--    rolled_from_* тримає ланцюжок 6-А → 7-А → 8-А: за ним можна показати
--    учневі його історію за минулі семестри, не змішуючи бали.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS semester_id          uuid,
  ADD COLUMN IF NOT EXISTS rolled_from_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_semester_same_teacher_fk;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_semester_same_teacher_fk
  FOREIGN KEY (semester_id, teacher_id)
  REFERENCES public.semesters (id, teacher_id)
  ON DELETE SET NULL (semester_id);

CREATE INDEX IF NOT EXISTS classes_semester_idx ON public.classes (semester_id);
CREATE INDEX IF NOT EXISTS classes_rolled_from_idx ON public.classes (rolled_from_class_id);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS rolled_from_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS students_rolled_from_idx ON public.students (rolled_from_student_id);

-- ---------------------------------------------------------------------------
-- 3. Ліміт класів рахує лише ЖИВІ класи — архів не займає місця.
--
-- Без цієї зміни семестри впираються в стелю самі собою: 5 класів × 4
-- семестри = 20, і на третій рік учитель не може перенести жоден клас.
-- Архівний клас — це історія, а не робоче місце, тож у ліміт він не йде.
-- Перевірка також вішається на UPDATE archived_at: розархівувати клас понад
-- ліміт так само не можна.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_active_class_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_limit constant int := 20;
  v_count int;
BEGIN
  -- Цікавить лише поява ЖИВОГО неархівного класу: INSERT, undelete, unarchive.
  IF TG_OP = 'UPDATE'
     AND NOT (OLD.deleted_at  IS NOT NULL AND NEW.deleted_at  IS NULL)
     AND NOT (OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('classes:' || NEW.teacher_id::text, 0));
  SELECT count(*) INTO v_count
  FROM public.classes
  WHERE teacher_id = NEW.teacher_id
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND id <> NEW.id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Досягнуто ліміт: не більше % активних класів на один акаунт', v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_trg ON public.classes;
CREATE TRIGGER limit_trg
  BEFORE INSERT OR UPDATE OF deleted_at, archived_at ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_class_limit();

-- ---------------------------------------------------------------------------
-- 4. Архівний клас — тільки для читання. Тут НІЧОГО не додаємо: уся заборона
--    вже стоїть із міграції 018 (assert_class_writable + archive_guard_trg на
--    lessons, star_entries, entry_types, prizes_individual, class_prizes,
--    class_prizes_given, class_groups, students, prizes_given). До семестрів
--    цей механізм просто не мав користувача — кнопку «Архівувати» прибрали з
--    інтерфейсу, бо «сховати клас» плутали з «видалити». Тепер архів має
--    точний зміст: семестр завершено.
--
--    Єдина правка: 018 свідомо дозволяє скидати PIN і в архівному класі
--    («учень забув PIN — вчитель мусить мати змогу скинути навіть після
--    архівації»), але список полів-винятків складали до міграції 033, яка
--    додала pin_encrypted. Через це reset_student_pin в архівному класі
--    падав би на guard-і, всупереч задуму. Додаємо поле у виняток.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.students_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND to_jsonb(NEW) - 'pin_hash' - 'pin_encrypted' - 'pin_set_at' - 'pin_generation'
       = to_jsonb(OLD) - 'pin_hash' - 'pin_encrypted' - 'pin_set_at' - 'pin_generation' THEN
    RETURN NEW;   -- зміна лише PIN-полів
  END IF;
  PERFORM public.assert_class_writable(coalesce(NEW.class_id, OLD.class_id));
  RETURN coalesce(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Перехід класу в новий семестр — одна транзакція в базі.
--
-- SECURITY INVOKER: усі читання й записи проходять RLS учителя, тож чужий
-- клас не перенесеш і в чужий семестр не покладеш. Клієнту лишається сам
-- майстер, а не десяток окремих запитів, кожен з яких може впасти посередині.
--
-- Порядок кроків важливий: архівуємо джерело ОСТАННІМ, бо archive_guard_trg
-- (018) інакше заблокував би решту записів у клас-джерело.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.roll_over_class(
  p_source_class_id uuid,
  p_semester_id     uuid,
  p_name            text,
  p_parallel_id     uuid    DEFAULT NULL,   -- NULL → та сама паралель
  p_student_ids     uuid[]  DEFAULT NULL,   -- NULL → усі живі учні
  p_copy_pins       boolean DEFAULT true,
  p_copy_config     boolean DEFAULT true,
  p_move_code       boolean DEFAULT true,
  p_archive_source  boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_src      public.classes%ROWTYPE;
  v_new_id   uuid;
  v_old_code text;
  v_name     text := btrim(p_name);
BEGIN
  IF v_name = '' OR length(v_name) > 60 THEN
    RAISE EXCEPTION 'Назва класу порожня або задовга';
  END IF;

  SELECT * INTO v_src FROM public.classes
  WHERE id = p_source_class_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Клас не знайдено або немає доступу';
  END IF;
  IF v_src.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Клас уже в архіві: перенести його вдруге не можна';
  END IF;
  IF v_src.is_public_demo THEN
    RAISE EXCEPTION 'Публічний демо-клас не переноситься';
  END IF;

  PERFORM 1 FROM public.semesters
  WHERE id = p_semester_id AND deleted_at IS NULL AND teacher_id = v_src.teacher_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Семестр не знайдено або немає доступу';
  END IF;

  INSERT INTO public.classes
    (name, teacher_id, parallel_id, semester_id, lessons_per_week,
     show_classmate_stars, rolled_from_class_id)
  VALUES
    (v_name, v_src.teacher_id, coalesce(p_parallel_id, v_src.parallel_id),
     p_semester_id, v_src.lessons_per_week, v_src.show_classmate_stars, v_src.id)
  RETURNING id INTO v_new_id;

  -- Конфігурація: або копія з класу-джерела, або стандартний шаблон.
  IF p_copy_config THEN
    INSERT INTO public.entry_types
      (class_id, name, sign, default_amount, is_lesson_bound, icon, color, sort_order, legacy_type)
    SELECT v_new_id, e.name, e.sign, e.default_amount, e.is_lesson_bound,
           e.icon, e.color, e.sort_order, e.legacy_type
    FROM public.entry_types e
    WHERE e.class_id = v_src.id AND e.deleted_at IS NULL;

    INSERT INTO public.prizes_individual (class_id, name, stars_required, emoji, sort_order)
    SELECT v_new_id, p.name, p.stars_required, p.emoji, p.sort_order
    FROM public.prizes_individual p
    WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

    INSERT INTO public.class_prizes (class_id, name, emoji, threshold, sort_order)
    SELECT v_new_id, p.name, p.emoji, p.threshold, p.sort_order
    FROM public.class_prizes p
    WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

    INSERT INTO public.class_groups (class_id, name, sort_order)
    SELECT v_new_id, g.name, g.sort_order
    FROM public.class_groups g
    WHERE g.class_id = v_src.id AND g.deleted_at IS NULL;
  ELSE
    PERFORM public.apply_class_template(v_new_id, NULL);
  END IF;

  -- Учні. Групи мапляться за назвою: class_groups_name_uq гарантує, що
  -- всередині класу назва унікальна, тож збігу «не тієї» групи бути не може.
  INSERT INTO public.students
    (class_id, full_name, nickname, avatar_emoji, group_id, rolled_from_student_id,
     pin_hash, pin_encrypted, pin_set_at)
  SELECT v_new_id, s.full_name, s.nickname, s.avatar_emoji, ng.id, s.id,
         CASE WHEN p_copy_pins THEN s.pin_hash      END,
         CASE WHEN p_copy_pins THEN s.pin_encrypted END,
         CASE WHEN p_copy_pins THEN s.pin_set_at    END
  FROM public.students s
  LEFT JOIN public.class_groups og ON og.id = s.group_id
  LEFT JOIN public.class_groups ng
         ON ng.class_id = v_new_id AND lower(ng.name) = lower(og.name)
  WHERE s.class_id = v_src.id
    AND s.deleted_at IS NULL
    AND (p_student_ids IS NULL OR s.id = ANY (p_student_ids))
  ORDER BY s.created_at;

  -- Код класу переїжджає на новий клас: для дітей не змінюється нічого —
  -- той самий код, той самий PIN. Архів отримує свіжий код, бо його
  -- відкриває лише вчитель. Спочатку звільняємо код, потім забираємо —
  -- інакше впаде унікальний індекс classes_public_code_key.
  IF p_move_code THEN
    v_old_code := v_src.public_code;
    UPDATE public.classes SET public_code = public.generate_class_public_code()
    WHERE id = v_src.id;
    UPDATE public.classes SET public_code = v_old_code WHERE id = v_new_id;
  END IF;

  -- Живі сесії учнів старого класу треба обірвати: інакше дитина ще 400 днів
  -- дивилась би торішній дашборд замість нового семестру. pin_generation —
  -- штатний механізм відкликання сесій (022), сам PIN від цього не міняється.
  IF p_move_code OR p_archive_source THEN
    UPDATE public.students SET pin_generation = pin_generation + 1
    WHERE class_id = v_src.id AND deleted_at IS NULL;
  END IF;

  IF p_archive_source THEN
    UPDATE public.classes SET archived_at = now() WHERE id = v_src.id;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.roll_over_class(uuid, uuid, text, uuid, uuid[], boolean, boolean, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roll_over_class(uuid, uuid, text, uuid, uuid[], boolean, boolean, boolean, boolean)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Бекфіл: наявні класи не можуть лишитись «без семестру», інакше кабінет
--    показував би їх у порожньому просторі поза будь-яким періодом. Кожному
--    вчителю з класами створюємо семестр навчального року, у якому ці класи
--    реально жили, і складаємо їх туди. Перейменувати його вчитель може
--    будь-коли — це звичайний рядок semesters.
-- ---------------------------------------------------------------------------
INSERT INTO public.semesters (teacher_id, name, starts_on, ends_on)
SELECT DISTINCT c.teacher_id, '2025/2026 навчальний рік', DATE '2025-09-01', DATE '2026-08-31'
FROM public.classes c
WHERE c.deleted_at IS NULL AND c.semester_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.classes c
SET semester_id = s.id
FROM public.semesters s
WHERE s.teacher_id = c.teacher_id
  AND s.name = '2025/2026 навчальний рік'
  AND c.semester_id IS NULL
  AND c.deleted_at IS NULL;

COMMIT;
