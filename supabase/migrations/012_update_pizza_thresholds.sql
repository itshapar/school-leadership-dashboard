-- 012_update_pizza_thresholds.sql
-- Update thresholds for specific classes

-- Initial defaults for all
UPDATE classes SET game_day_threshold = 250, pizza_day_threshold = 350;

-- Custom values for special classes
UPDATE classes SET pizza_day_threshold = 400 WHERE name = '7А';

UPDATE classes SET game_day_threshold = 100, pizza_day_threshold = 200 WHERE name = '7В';

UPDATE classes SET game_day_threshold = 200, pizza_day_threshold = 300 WHERE name IN ('7Г', '7Д', '7Е');
