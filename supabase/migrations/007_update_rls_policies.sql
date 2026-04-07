-- 007_update_rls_policies.sql
-- Fix broken authorization by scoping access to the class teacher

-- Classes: Only the teacher of the class can modify it
DROP POLICY IF EXISTS "admin_all_classes" ON classes;
CREATE POLICY "admin_all_classes" ON classes 
FOR ALL USING (auth.uid() = teacher_id) 
WITH CHECK (auth.uid() = teacher_id);

-- Students: Only the teacher of the student's class can modify
DROP POLICY IF EXISTS "admin_all_students" ON students;
CREATE POLICY "admin_all_students" ON students 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

-- Lessons: Only the teacher of the lesson's class can modify
DROP POLICY IF EXISTS "admin_all_lessons" ON lessons;
CREATE POLICY "admin_all_lessons" ON lessons 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

-- Star Entries: Only the teacher of the entry's class can modify
DROP POLICY IF EXISTS "admin_all_star_entries" ON star_entries;
CREATE POLICY "admin_all_star_entries" ON star_entries 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

-- Individual Prizes: Only the teacher of the prize's class can modify
DROP POLICY IF EXISTS "admin_all_prizes_individual" ON prizes_individual;
CREATE POLICY "admin_all_prizes_individual" ON prizes_individual 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

-- Prizes Given: Only the teacher of the student's class can modify
DROP POLICY IF EXISTS "admin_all_prizes_given" ON prizes_given;
CREATE POLICY "admin_all_prizes_given" ON prizes_given 
FOR ALL 
USING (student_id IN (SELECT id FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())))
WITH CHECK (student_id IN (SELECT id FROM students WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())));

-- Class Prizes Given: Only the teacher of the prize's class can modify
DROP POLICY IF EXISTS "admin_all_class_prizes_given" ON class_prizes_given;
CREATE POLICY "admin_all_class_prizes_given" ON class_prizes_given 
FOR ALL 
USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));
