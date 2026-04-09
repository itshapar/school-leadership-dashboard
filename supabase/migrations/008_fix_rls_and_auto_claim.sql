-- 008_fix_rls_and_auto_claim.sql
-- Allow teachers to access classes that have no teacher_id assigned yet (auto-claimable)

-- Classes
DROP POLICY IF EXISTS "admin_all_classes" ON classes;
CREATE POLICY "admin_all_classes" ON classes 
FOR ALL USING (teacher_id IS NULL OR teacher_id = auth.uid()) 
WITH CHECK (teacher_id IS NULL OR teacher_id = auth.uid());

-- Students
DROP POLICY IF EXISTS "admin_all_students" ON students;
CREATE POLICY "admin_all_students" ON students 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()));

-- Lessons
DROP POLICY IF EXISTS "admin_all_lessons" ON lessons;
CREATE POLICY "admin_all_lessons" ON lessons 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()));

-- Star Entries
DROP POLICY IF EXISTS "admin_all_star_entries" ON star_entries;
CREATE POLICY "admin_all_star_entries" ON star_entries 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()));

-- Individual Prizes
DROP POLICY IF EXISTS "admin_all_prizes_individual" ON prizes_individual;
CREATE POLICY "admin_all_prizes_individual" ON prizes_individual 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()));

-- Prizes Given
DROP POLICY IF EXISTS "admin_all_prizes_given" ON prizes_given;
CREATE POLICY "admin_all_prizes_given" ON prizes_given 
FOR ALL 
USING (student_id IN (SELECT id FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))))
WITH CHECK (student_id IN (SELECT id FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))));

-- Class Prizes Given
DROP POLICY IF EXISTS "admin_all_class_prizes_given" ON class_prizes_given;
CREATE POLICY "admin_all_class_prizes_given" ON class_prizes_given 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id IS NULL OR teacher_id = auth.uid()));
