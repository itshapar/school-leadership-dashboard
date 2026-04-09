-- Seed: 6 Classes + Prize Templates
-- Run AFTER 001_init.sql

-- Insert classes (get IDs back for prize seeding)
WITH inserted_classes AS (
  INSERT INTO classes (id, name, slug, game_day_threshold, pizza_day_threshold, lessons_per_week) VALUES
    ('11111111-0000-0000-0000-000000000001', '7А', '4827', 250, 400, 2),
    ('11111111-0000-0000-0000-000000000002', '7Б', '1593', 500, 350, 2),
    ('11111111-0000-0000-0000-000000000003', '7В', '7041', 250, 350, 2),
    ('11111111-0000-0000-0000-000000000004', '7Г', '9365', 500, 350, 2),
    ('11111111-0000-0000-0000-000000000005', '7Д', '2180', 500, 350, 2),
    ('11111111-0000-0000-0000-000000000006', '7Е', '6674', 350, 350, 2)
  ON CONFLICT (id) DO NOTHING
  RETURNING id, name
)
SELECT * FROM inserted_classes;

-- Individual prizes for 7А (3d_print threshold = 40)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000001', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000001', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000001', 40, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;

-- Individual prizes for 7Б (3d_print threshold = 50)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000002', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000002', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000002', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000002', 50, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;

-- Individual prizes for 7В (3d_print threshold = 40)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000003', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000003', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000003', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000003', 40, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;

-- Individual prizes for 7Г (3d_print threshold = 50)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000004', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000004', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000004', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000004', 50, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;

-- Individual prizes for 7Д (3d_print threshold = 50)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000005', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000005', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000005', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000005', 50, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;

-- Individual prizes for 7Е (3d_print threshold = 50)
INSERT INTO prizes_individual (class_id, stars_required, name, emoji, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000006', 10, 'Кіндер', '🍬', 1),
  ('11111111-0000-0000-0000-000000000006', 20, 'Стікери', '🏷️', 2),
  ('11111111-0000-0000-0000-000000000006', 30, 'Пін', '📍', 3),
  ('11111111-0000-0000-0000-000000000006', 50, '3Д Друк', '📦', 4)
ON CONFLICT DO NOTHING;
