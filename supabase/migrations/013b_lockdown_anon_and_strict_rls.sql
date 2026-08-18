-- 013b_lockdown_anon_and_strict_rls.sql
--
-- ФАЗА 2 із 2. Ця міграція ЗАКРИВАЄ витік. Застосовувати ПІСЛЯ 013a
-- і бажано після деплою нового коду (стара публічна сторінка читає таблиці
-- напряму і після цієї міграції перестане працювати — це і є мета).
--
-- Що робить:
--   1. Прибирає ВСІ anon SELECT-політики (п.1 задачі).
--   2. Прибирає табличні GRANT для ролі anon — другий рубіж, щоб RLS не був
--      єдиним бар'єром. Після цього anon має рівно один шлях до даних:
--      public_class_overview() / public_student_dashboard() з 013a.
--   3. Переписує політики для authenticated БЕЗ винятку `teacher_id IS NULL`
--      і з явним `TO authenticated` (зараз вони створені як TO public,
--      тобто діють і на anon — це дірка не тільки на читання, а й на запис:
--      anon міг би писати в будь-який клас із teacher_id IS NULL).
--
-- Жоден рядок даних не видаляється.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Геть увесь anon-доступ через політики
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_view_classes_anon"       ON classes;
DROP POLICY IF EXISTS "public_view_students_anon"      ON students;
DROP POLICY IF EXISTS "public_view_lessons_anon"       ON lessons;
DROP POLICY IF EXISTS "public_view_star_entries_anon"  ON star_entries;

-- Ці три 011 створила як `TO anon, authenticated USING (true)` і забула звузити.
DROP POLICY IF EXISTS "public_view_prizes_individual"  ON prizes_individual;
DROP POLICY IF EXISTS "public_view_prizes_given"       ON prizes_given;
DROP POLICY IF EXISTS "public_view_class_prizes_given" ON class_prizes_given;

-- Старі SELECT-політики для authenticated (замінюються на FOR ALL нижче)
DROP POLICY IF EXISTS "public_view_classes_auth"       ON classes;
DROP POLICY IF EXISTS "public_view_students_auth"      ON students;
DROP POLICY IF EXISTS "public_view_lessons_auth"       ON lessons;
DROP POLICY IF EXISTS "public_view_star_entries_auth"  ON star_entries;

-- Реліквії з 001, якщо десь лишились
DROP POLICY IF EXISTS "public_read_classes"            ON classes;
DROP POLICY IF EXISTS "public_read_students"           ON students;
DROP POLICY IF EXISTS "public_read_lessons"            ON lessons;
DROP POLICY IF EXISTS "public_read_star_entries"       ON star_entries;
DROP POLICY IF EXISTS "public_read_prizes_individual"  ON prizes_individual;
DROP POLICY IF EXISTS "public_read_prizes_given"       ON prizes_given;
DROP POLICY IF EXISTS "public_read_class_prizes_given" ON class_prizes_given;

-- ---------------------------------------------------------------------------
-- 2. Строгі політики для вчителя. Без `teacher_id IS NULL`, з явним TO authenticated.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_all_classes"            ON classes;
DROP POLICY IF EXISTS "teacher_owns_classes" ON classes;
CREATE POLICY "teacher_owns_classes" ON classes
  FOR ALL TO authenticated
  USING      (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_students" ON students;
DROP POLICY IF EXISTS "teacher_owns_students" ON students;
CREATE POLICY "teacher_owns_students" ON students
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admin_all_lessons" ON lessons;
DROP POLICY IF EXISTS "teacher_owns_lessons" ON lessons;
CREATE POLICY "teacher_owns_lessons" ON lessons
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = lessons.class_id AND c.teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admin_all_star_entries" ON star_entries;
DROP POLICY IF EXISTS "teacher_owns_star_entries" ON star_entries;
CREATE POLICY "teacher_owns_star_entries" ON star_entries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = star_entries.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = star_entries.class_id AND c.teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admin_all_prizes_individual" ON prizes_individual;
DROP POLICY IF EXISTS "teacher_owns_prizes_individual" ON prizes_individual;
CREATE POLICY "teacher_owns_prizes_individual" ON prizes_individual
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = prizes_individual.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = prizes_individual.class_id AND c.teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admin_all_prizes_given" ON prizes_given;
DROP POLICY IF EXISTS "teacher_owns_prizes_given" ON prizes_given;
CREATE POLICY "teacher_owns_prizes_given" ON prizes_given
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.id = prizes_given.student_id AND c.teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "admin_all_class_prizes_given" ON class_prizes_given;
DROP POLICY IF EXISTS "teacher_owns_class_prizes_given" ON class_prizes_given;
CREATE POLICY "teacher_owns_class_prizes_given" ON class_prizes_given
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = class_prizes_given.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c WHERE c.id = class_prizes_given.class_id AND c.teacher_id = auth.uid()
  ));

-- RLS має бути увімкнений (перестраховка)
ALTER TABLE classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes_individual  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes_given       ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_prizes_given ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Другий рубіж: забрати в anon самі GRANT-и на таблиці.
--    Навіть якщо колись хтось випадково створить дозвільну політику для anon,
--    даних він не побачить — не буде табличного привілею.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE classes            FROM anon;
REVOKE ALL ON TABLE students           FROM anon;
REVOKE ALL ON TABLE lessons            FROM anon;
REVOKE ALL ON TABLE star_entries       FROM anon;
REVOKE ALL ON TABLE prizes_individual  FROM anon;
REVOKE ALL ON TABLE prizes_given       FROM anon;
REVOKE ALL ON TABLE class_prizes_given FROM anon;

-- ...і для таблиць, які будуть створені в майбутньому
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- anon все ще потрібен USAGE на схему, щоб PostgREST дозволив виклик RPC
GRANT USAGE ON SCHEMA public TO anon;

-- ---------------------------------------------------------------------------
-- 4. Страховка по власності класів (п.5).
--    Станом на 2026-08-18 усі 6 класів уже мають teacher_id — цей UPDATE
--    нічого не змінить. Лишаю як явну дію: виконай його ЗАЛОГІНЕНИМ під
--    своїм акаунтом (Supabase SQL Editor виконує від service_role, тому
--    auth.uid() там буде NULL — підстав свій uid явно).
--
--    Твій uid: 037e7f5f-0f0b-454c-b041-601d2f27eb2a
--
--    UPDATE classes
--    SET teacher_id = '037e7f5f-0f0b-454c-b041-601d2f27eb2a'
--    WHERE teacher_id IS NULL;
--
--    Перевірка, що безхазяйних класів не лишилось:
--    SELECT count(*) FROM classes WHERE teacher_id IS NULL;   -- має бути 0
-- ---------------------------------------------------------------------------

COMMIT;
