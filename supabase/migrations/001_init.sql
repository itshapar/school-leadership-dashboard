-- StarBoard Database Migration
-- Run this in the Supabase SQL Editor

-- Enums
CREATE TYPE star_type AS ENUM ('lesson', 'bonus', 'penalty');
CREATE TYPE class_prize_type AS ENUM ('game_day', 'pizza_day');

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES auth.users(id),
  game_day_threshold INT NOT NULL DEFAULT 250,
  pizza_day_threshold INT NOT NULL DEFAULT 500,
  lessons_per_week INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  avatar_emoji TEXT NOT NULL DEFAULT '⭐',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Star Entries (lesson stars, bonuses, penalties)
CREATE TABLE IF NOT EXISTS star_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE, -- null = whole class
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  type star_type NOT NULL DEFAULT 'lesson',
  amount INT NOT NULL CHECK (amount != 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual prizes per class (thresholds differ between classes)
CREATE TABLE IF NOT EXISTS prizes_individual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  stars_required INT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎁',
  sort_order INT NOT NULL DEFAULT 0
);

-- Prizes given to individual students
CREATE TABLE IF NOT EXISTS prizes_given (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  prize_id UUID NOT NULL REFERENCES prizes_individual(id) ON DELETE CASCADE,
  given_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class-level prizes (game day, pizza day)
CREATE TABLE IF NOT EXISTS class_prizes_given (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  prize_type class_prize_type NOT NULL,
  given_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_star_entries_student ON star_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_star_entries_class ON star_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);

-- RLS: Enable row level security
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes_individual ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes_given ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_prizes_given ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (students don't need accounts)
CREATE POLICY "public_read_classes" ON classes FOR SELECT USING (true);
CREATE POLICY "public_read_students" ON students FOR SELECT USING (true);
CREATE POLICY "public_read_lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "public_read_star_entries" ON star_entries FOR SELECT USING (true);
CREATE POLICY "public_read_prizes_individual" ON prizes_individual FOR SELECT USING (true);
CREATE POLICY "public_read_prizes_given" ON prizes_given FOR SELECT USING (true);
CREATE POLICY "public_read_class_prizes_given" ON class_prizes_given FOR SELECT USING (true);

-- Admin write access (authenticated users only)
CREATE POLICY "admin_all_classes" ON classes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_students" ON students FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_lessons" ON lessons FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_star_entries" ON star_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_prizes_individual" ON prizes_individual FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_prizes_given" ON prizes_given FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all_class_prizes_given" ON class_prizes_given FOR ALL USING (auth.role() = 'authenticated');
