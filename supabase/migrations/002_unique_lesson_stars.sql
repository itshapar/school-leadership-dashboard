-- Add unique constraint to star_entries for upserting lesson stars
ALTER TABLE star_entries 
ADD CONSTRAINT unique_student_lesson_star 
UNIQUE (student_id, lesson_id);
