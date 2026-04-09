-- 009_robust_rls_and_permission_fix.sql
-- Even more robust RLS using EXISTS and ensuring SELECT permissions are correct

-- Classes: Ensure user can see and edit their owned or unowned classes
DROP POLICY IF EXISTS "admin_all_classes" ON classes;
CREATE POLICY "admin_all_classes" ON classes 
FOR ALL USING (teacher_id IS NULL OR teacher_id = auth.uid());

-- Students
DROP POLICY IF EXISTS "admin_all_students" ON students;
CREATE POLICY "admin_all_students" ON students 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = students.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

-- Lessons
DROP POLICY IF EXISTS "admin_all_lessons" ON lessons;
CREATE POLICY "admin_all_lessons" ON lessons 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = lessons.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

-- Star Entries
DROP POLICY IF EXISTS "admin_all_star_entries" ON star_entries;
CREATE POLICY "admin_all_star_entries" ON star_entries 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = star_entries.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

-- Individual Prizes
DROP POLICY IF EXISTS "admin_all_prizes_individual" ON prizes_individual;
CREATE POLICY "admin_all_prizes_individual" ON prizes_individual 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = prizes_individual.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

-- Prizes Given
DROP POLICY IF EXISTS "admin_all_prizes_given" ON prizes_given;
CREATE POLICY "admin_all_prizes_given" ON prizes_given 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM students
    JOIN classes ON classes.id = students.class_id
    WHERE students.id = prizes_given.student_id
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

-- Class Prizes Given
DROP POLICY IF EXISTS "admin_all_class_prizes_given" ON class_prizes_given;
CREATE POLICY "admin_all_class_prizes_given" ON class_prizes_given 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = class_prizes_given.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);
