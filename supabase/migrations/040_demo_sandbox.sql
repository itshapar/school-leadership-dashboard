-- ============================================================================
-- 040_demo_sandbox.sql
-- Пісочниця демо (живий фідбек): «демо має бути такий самий інтерфейс, що і
-- у зареєстрованого вчителя, і там мають працювати всі функції, просто воно
-- не має зберігати нічого після завершення сесії».
--
-- Рішення: гість входить анонімно (Supabase anonymous sign-in), і йому
-- створюється ВЛАСНА копія демо-класу. Далі він працює у звичайному кабінеті
-- під звичайним RLS: нарахування, уроки, нагороди, новий клас, усе працює
-- по-справжньому, бо це і є справжній кабінет. Нічого спільного з іншими
-- гостями він не бачить і зіпсувати не може.
--
-- «Не зберігається після сесії» забезпечує прибирання: delete_stale_demo_users
-- зносить анонімних користувачів разом з їхніми даними (ON DELETE CASCADE від
-- auth.users), і викликається за розкладом.
--
-- Чому копія, а не спільний демо-клас: спільний означає, що перший гість
-- поставить трієчку, а другий побачить її і подумає, що так і було; плюс
-- будь-хто міг би переписати назви учнів на матюки й показувати це решті.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Створення пісочниці
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_demo_sandbox()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_src    public.classes%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Потрібна сесія';
  END IF;

  -- Одна пісочниця на користувача: повторний виклик (перезавантаження
  -- сторінки, друга вкладка) повертає наявний клас, а не плодить копії.
  SELECT id INTO v_new_id
  FROM public.classes
  WHERE teacher_id = v_uid AND is_demo = true AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;
  IF v_new_id IS NOT NULL THEN
    RETURN v_new_id;
  END IF;

  SELECT * INTO v_src FROM public.classes
  WHERE is_public_demo = true AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Демо-клас не налаштований';
  END IF;

  -- Клас. Публічний код НЕ копіюється: він генерується тригером, інакше два
  -- класи ділили б один код, і вхід учня за кодом вів би невідомо куди.
  INSERT INTO public.classes
    (name, teacher_id, parallel_id, period_code, lessons_per_week,
     show_classmate_stars, game_day_threshold, pizza_day_threshold, is_demo)
  VALUES
    (v_src.name, v_uid, v_src.parallel_id,
     public.period_of((now() AT TIME ZONE 'Europe/Kyiv')::date),
     v_src.lessons_per_week, v_src.show_classmate_stars,
     v_src.game_day_threshold, v_src.pizza_day_threshold, true)
  RETURNING id INTO v_new_id;

  -- Конфігурація класу.
  INSERT INTO public.entry_types
    (class_id, name, sign, default_amount, is_lesson_bound, icon, color, sort_order, legacy_type)
  SELECT v_new_id, e.name, e.sign, e.default_amount, e.is_lesson_bound,
         e.icon, e.color, e.sort_order, e.legacy_type
  FROM public.entry_types e
  WHERE e.class_id = v_src.id AND e.deleted_at IS NULL;

  INSERT INTO public.prizes_individual (class_id, name, stars_required, emoji, sort_order)
  SELECT v_new_id, p.name, p.stars_required, p.emoji, p.sort_order
  FROM public.prizes_individual p
  WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

  INSERT INTO public.class_prizes (class_id, name, emoji, threshold, sort_order)
  SELECT v_new_id, p.name, p.emoji, p.threshold, p.sort_order
  FROM public.class_prizes p
  WHERE p.class_id = v_src.id AND p.deleted_at IS NULL;

  INSERT INTO public.class_groups (class_id, name, sort_order)
  SELECT v_new_id, g.name, g.sort_order
  FROM public.class_groups g
  WHERE g.class_id = v_src.id AND g.deleted_at IS NULL;

  -- Учні. PIN-и копіюються: у пісочниці має працювати і вхід учня за кодом.
  -- rolled_from_student_id тримає зв'язок «новий учень ← учень-джерело», і
  -- саме за ним нижче переносяться нарахування й видані нагороди.
  INSERT INTO public.students
    (class_id, full_name, nickname, avatar_emoji, group_id, rolled_from_student_id,
     pin_hash, pin_encrypted, pin_set_at)
  SELECT v_new_id, s.full_name, s.nickname, s.avatar_emoji, ng.id, s.id,
         s.pin_hash, s.pin_encrypted, s.pin_set_at
  FROM public.students s
  LEFT JOIN public.class_groups og ON og.id = s.group_id
  LEFT JOIN public.class_groups ng
         ON ng.class_id = v_new_id AND lower(ng.name) = lower(og.name)
  WHERE s.class_id = v_src.id AND s.deleted_at IS NULL;

  -- Уроки.
  CREATE TEMP TABLE _lesson_map ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO public.lessons (class_id, date)
    SELECT v_new_id, l.date
    FROM public.lessons l
    WHERE l.class_id = v_src.id AND l.deleted_at IS NULL
    RETURNING id, date
  )
  SELECT l.id AS old_id, ins.id AS new_id
  FROM public.lessons l
  JOIN ins ON ins.date = l.date
  WHERE l.class_id = v_src.id AND l.deleted_at IS NULL;

  -- Нарахування. Типи мапляться за назвою (в межах класу вона унікальна),
  -- уроки за датою, учні за rolled_from_student_id.
  INSERT INTO public.star_entries
    (student_id, class_id, lesson_id, amount, note, entry_type_id, scope, group_id, type)
  SELECT ns.id, v_new_id, lm.new_id, e.amount, e.note, nt.id, e.scope, NULL, e.type
  FROM public.star_entries e
  LEFT JOIN public.students ns
         ON ns.class_id = v_new_id AND ns.rolled_from_student_id = e.student_id
  LEFT JOIN _lesson_map lm ON lm.old_id = e.lesson_id
  LEFT JOIN public.entry_types ot ON ot.id = e.entry_type_id
  LEFT JOIN public.entry_types nt
         ON nt.class_id = v_new_id AND nt.name = ot.name
  WHERE e.class_id = v_src.id
    -- Індивідуальне нарахування без пари серед нових учнів не переносимо:
    -- це був би запис у нікуди.
    AND (e.student_id IS NULL OR ns.id IS NOT NULL);

  -- Видані нагороди: у демо частина призів уже має бути відмічена (живий
  -- фідбек), інакше колонки нагород виглядають так, ніби ними не користуються.
  INSERT INTO public.prizes_given (student_id, prize_id)
  SELECT ns.id, np.id
  FROM public.prizes_given g
  JOIN public.students os ON os.id = g.student_id AND os.class_id = v_src.id
  JOIN public.students ns ON ns.class_id = v_new_id AND ns.rolled_from_student_id = os.id
  JOIN public.prizes_individual op ON op.id = g.prize_id
  JOIN public.prizes_individual np
       ON np.class_id = v_new_id AND np.name = op.name
  ON CONFLICT DO NOTHING;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_demo_sandbox() FROM PUBLIC;
-- Тільки для тих, хто має сесію (анонімну або справжню). anon без сесії
-- викликати не може: auth.uid() у нього NULL, і функція одразу падає.
GRANT EXECUTE ON FUNCTION public.create_demo_sandbox() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Прибирання
-- ---------------------------------------------------------------------------
-- «Нічого не зберігається після сесії» тримається саме тут: анонімний
-- користувач живе кілька годин, потім зникає разом з усіма своїми класами,
-- учнями й нарахуваннями (каскад від auth.users).
CREATE OR REPLACE FUNCTION public.delete_stale_demo_users(p_older_than interval DEFAULT '6 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH doomed AS (
    DELETE FROM auth.users u
    WHERE u.is_anonymous = true
      AND u.created_at < now() - p_older_than
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM doomed;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_stale_demo_users(interval) FROM PUBLIC;

COMMIT;
