-- 012_update_pizza_thresholds.sql
-- Update pizza_day_threshold for all classes to 350
-- except for 7А which should be 400

UPDATE classes SET pizza_day_threshold = 350;
UPDATE classes SET pizza_day_threshold = 400 WHERE name = '7А';
