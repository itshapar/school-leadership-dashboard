-- 011_remove_public_leaks.sql
-- Removes legacy "public_read" policies that allow any authenticated user 
-- to see other teachers data via the public SELECT access.

-- Drop all legacy public read policies
DROP POLICY IF EXISTS "public_read_classes" ON classes;
DROP POLICY IF EXISTS "public_read_students" ON students;
DROP POLICY IF EXISTS "public_read_lessons" ON lessons;
DROP POLICY IF EXISTS "public_read_star_entries" ON star_entries;
DROP POLICY IF EXISTS "public_read_prizes_individual" ON prizes_individual;
DROP POLICY IF EXISTS "public_read_prizes_given" ON prizes_given;
DROP POLICY IF EXISTS "public_read_class_prizes_given" ON class_prizes_given;

-- Re-implement SCRICT public access for students/parents
-- These allow SELECT only. We still use "true" for simplicity of the public view,
-- but by removing the generic "public_read" we ensure that subsequent policies 
-- or role-based checks can be more specific. 
-- Actually, the best way is to keep these for ANON only if we want to separate 
-- Teacher dashboard (Authenticated) from Student view (Anon).

CREATE POLICY "public_view_classes" ON classes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_students" ON students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_lessons" ON lessons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_star_entries" ON star_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_prizes_individual" ON prizes_individual FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_prizes_given" ON prizes_given FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_view_class_prizes_given" ON class_prizes_given FOR SELECT TO anon, authenticated USING (true);

-- NOTE: If we want TRUE Zero Trust where Teachers only see their own classes 
-- even in the list, we would need to remove "authenticated" from the policies above.
-- However, that might break features where teachers collaborate.
-- Since the current objective is "Scaling Safety" and "Isolation", let's restrict 
-- the classes SELECT for authenticated users to their own data, while keeping
-- public view open for everyone (including anon).

DROP POLICY IF EXISTS "public_view_classes" ON classes;
CREATE POLICY "public_view_classes_anon" ON classes FOR SELECT TO anon USING (true);
CREATE POLICY "public_view_classes_auth" ON classes FOR SELECT TO authenticated USING (teacher_id IS NULL OR teacher_id = auth.uid());

-- Repeat for related tables to ensure full isolation for Teachers
DROP POLICY IF EXISTS "public_view_students" ON students;
CREATE POLICY "public_view_students_anon" ON students FOR SELECT TO anon USING (true);
CREATE POLICY "public_view_students_auth" ON students FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = students.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "public_view_lessons" ON lessons;
CREATE POLICY "public_view_lessons_anon" ON lessons FOR SELECT TO anon USING (true);
CREATE POLICY "public_view_lessons_auth" ON lessons FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = lessons.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "public_view_star_entries" ON star_entries;
CREATE POLICY "public_view_star_entries_anon" ON star_entries FOR SELECT TO anon USING (true);
CREATE POLICY "public_view_star_entries_auth" ON star_entries FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = star_entries.class_id 
    AND (classes.teacher_id IS NULL OR classes.teacher_id = auth.uid())
  )
);
