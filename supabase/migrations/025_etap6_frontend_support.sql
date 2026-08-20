-- ============================================================================
-- 025_etap6_frontend_support.sql
-- Етап 6 · адитивна · застосовувати ДО 020_post_deploy_cleanup
--
-- Порядок застосування Етапу 6:
--   025 (цей файл)  →  деплой нового фронтенду  →  020  →  роздача PIN-ів  →  024
--
-- Три незалежні речі, які потрібні фронтенду Етапу 6:
--   1. Замінник унікальності журналу, що переживе DROP COLUMN type у 020.
--   2. Позначка демо-класу (Фаза B онбордингу).
--   3. Фіксація акцепту Умов вчителем (Фаза C, юридичний пакет Етапу 5).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Унікальність «одна оцінка на учня за урок у межах типу».
--
-- ГРАБЛЯ, знайдена при аудиті Етапу 6: автозбереження в журналі робить
--   upsert(..., { onConflict: 'student_id,lesson_id,type' })
-- і спирається на констрейнт unique_student_lesson_type_star (міграція 006),
-- який включає стовпець star_entries.type. Міграція 020 робить
-- DROP COLUMN type → констрейнт зникає РАЗОМ зі стовпцем, і журнал почав би
-- мовчки плодити дублікати замість оновлення оцінки.
--
-- Тому замінник створюємо ЗАРАЗ, адитивно, поряд зі старим: обидва живуть
-- паралельно до 020, семантика однакова (entry_type_id детермінований для
-- кожного type завдяки місткові з 015).
--
-- Індекс ПОВНИЙ, без предиката WHERE lesson_id IS NOT NULL, і це важливо:
-- PostgREST будує `ON CONFLICT (cols) DO UPDATE`, а PostgreSQL не вміє
-- вивести ЧАСТКОВИЙ унікальний індекс без відповідного WHERE у самому
-- запиті — upsert журналу впав би з «no unique or exclusion constraint
-- matching the ON CONFLICT specification».
--
-- Предикат і не потрібен: UNIQUE трактує NULL як різні значення, тож рядки
-- поза уроком (lesson_id IS NULL — бонуси, штрафи, класові нарахування)
-- ніколи не конфліктують між собою. Семантика точно така сама, як у старого
-- unique_student_lesson_type_star.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.star_entries_lesson_slot_uq;
CREATE UNIQUE INDEX IF NOT EXISTS star_entries_lesson_slot_uq
  ON public.star_entries (student_id, lesson_id, entry_type_id);

COMMENT ON INDEX public.star_entries_lesson_slot_uq IS
  'Опора для upsert журналу після 020 (замінник unique_student_lesson_type_star).';

-- ---------------------------------------------------------------------------
-- 2. Демо-клас (PRD §5.2, онбординг).
--
-- Позначка стовпцем, а не угодою про назву: «видалити демо-дані» мусить бути
-- детермінованим. Клас, перейменований вчителем, все одно лишається демо;
-- клас, названий «Демо», але створений вручну — ні.
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.classes.is_demo IS
  'Клас із фейковими даними, створений майстром онбордингу. Видаляється кнопкою «Видалити демо-дані».';

CREATE INDEX IF NOT EXISTS classes_demo_idx
  ON public.classes (teacher_id) WHERE is_demo;

-- Гранти на новий стовпець: RLS classes_* уже обмежує рядки teacher_id =
-- auth.uid(); табличні гранти для classes видані в 019 як GRANT ... ON TABLE,
-- тобто новий стовпець ними покривається автоматично. anon грантів на classes
-- не має з 013b — новий стовпець нічого не змінює.

-- ---------------------------------------------------------------------------
-- 3. Акцепт Умов вчителем (Етап 5, п. 9).
--
-- ДВА окремі факти, а не один: (а) прийняття Умов; (б) окреме запевнення про
-- правові підстави внесення даних учнів (розділ 5 Умов). Зберігаємо їх
-- окремими стовпцями, бо юридично це різні заяви — «прийняв Умови» не
-- дорівнює «підтвердив, що має правові підстави».
--
-- Версія Умов у ключі: після рев'ю юриста нова версія (v1.0) не знайде рядка
-- і фронтенд попросить акцепт повторно. Це і є механізм переакцепту.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version        text NOT NULL CHECK (length(btrim(terms_version)) BETWEEN 1 AND 40),
  accepted_terms       boolean NOT NULL,
  accepted_data_basis  boolean NOT NULL,
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  -- Джерело акцепту: 'signup' (форма реєстрації email), 'oauth' (Google —
  -- метаданих у signUp немає, акцепт фіксується guard-ом після входу),
  -- 'guard' (наявний акаунт або нова версія Умов).
  source               text NOT NULL DEFAULT 'guard'
                       CHECK (source IN ('signup', 'oauth', 'guard')),
  UNIQUE (user_id, terms_version)
);

COMMENT ON TABLE public.terms_acceptances IS
  'Факт прийняття Умов вчителем + окреме запевнення про правові підстави (Етап 5). Append-only.';

CREATE INDEX IF NOT EXISTS terms_acceptances_user_idx
  ON public.terms_acceptances (user_id);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Гранти: explicit-only, патерн 019a/019b. anon не має нічого.
REVOKE ALL ON public.terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL    ON public.terms_acceptances TO service_role;

-- Чотири політики, як вимагає наскрізне правило. UPDATE і DELETE — свідомо
-- USING (false) WITH CHECK (false), а не «політики немає»: акцепт, який
-- суб'єкт може відредагувати або стерти заднім числом, юридично нічого не
-- доводить. Явна відмова читається як рішення, а не як недогляд.
-- Право на забуття закривається каскадом від auth.users
-- (hard_delete_teacher_account + видалення рядка користувача Admin API).
DROP POLICY IF EXISTS terms_acceptances_select_own ON public.terms_acceptances;
CREATE POLICY terms_acceptances_select_own ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS terms_acceptances_insert_own ON public.terms_acceptances;
CREATE POLICY terms_acceptances_insert_own ON public.terms_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS terms_acceptances_update_none ON public.terms_acceptances;
CREATE POLICY terms_acceptances_update_none ON public.terms_acceptances
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS terms_acceptances_delete_none ON public.terms_acceptances;
CREATE POLICY terms_acceptances_delete_none ON public.terms_acceptances
  FOR DELETE TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- 3.1 RPC фіксації акцепту.
--
-- SECURITY INVOKER: INSERT проходить RLS вчителя, чужий акцепт не запишеш.
-- Ідемпотентна: повторний виклик для тієї ж версії нічого не змінює
-- (перший акцепт — той, що має силу; ON CONFLICT DO NOTHING зберігає
-- саме його мітку часу).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_version    text,
  p_data_basis boolean,
  p_source     text DEFAULT 'guard'
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Потрібна автентифікація';
  END IF;
  IF p_data_basis IS NOT TRUE THEN
    RAISE EXCEPTION 'Запевнення про правові підстави є обов''язковим';
  END IF;

  INSERT INTO public.terms_acceptances
    (user_id, terms_version, accepted_terms, accepted_data_basis, source)
  VALUES
    (auth.uid(), btrim(p_version), true, true,
     CASE WHEN p_source IN ('signup', 'oauth', 'guard') THEN p_source ELSE 'guard' END)
  ON CONFLICT (user_id, terms_version) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_terms_acceptance(text, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_terms_acceptance(text, boolean, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3.2 Email-реєстрація: акцепт приїжджає в метаданих signUp.
--
-- Розширюємо handle_new_user із 021 (та сама сигнатура, той самий тригер).
-- Google OAuth сюди не потрапляє: у нього метаданих форми немає, тому акцепт
-- фіксує guard у кабінеті вже під сесією. Ми свідомо НЕ вигадуємо акцепт за
-- користувача — записуємо лише те, що він реально позначив у формі.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_version text := NULLIF(TRIM(NEW.raw_user_meta_data->>'terms_version'), '');
BEGIN
  INSERT INTO public.teacher_profiles (id, display_name)
  VALUES (
    NEW.id,
    LEFT(COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),  -- наша форма реєстрації
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),     -- Google OAuth
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),          -- Google OAuth (fallback)
      split_part(COALESCE(NEW.email, ''), '@', 1),
      ''
    ), 100)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Акцепт фіксуємо, лише якщо форма реєстрації надіслала ОБИДВА підтвердження.
  IF v_version IS NOT NULL
     AND (NEW.raw_user_meta_data->>'accepted_terms')      = 'true'
     AND (NEW.raw_user_meta_data->>'accepted_data_basis') = 'true'
  THEN
    INSERT INTO public.terms_acceptances
      (user_id, terms_version, accepted_terms, accepted_data_basis, source)
    VALUES (NEW.id, LEFT(v_version, 40), true, true, 'signup')
    ON CONFLICT (user_id, terms_version) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================================================
-- Свідомо НЕ робимо тут:
--  • бекфіл terms_acceptances для наявних акаунтів — акцепт не можна
--    проставити за людину; наявні вчителі (в т.ч. Andrew) пройдуть guard
--    у кабінеті при першому вході після деплою;
--  • стовпця «прогрес майстра онбордингу» — прогрес виводиться з фактичного
--    стану БД (є клас / є учні / є типи / є призи / роздано PIN-и), тому
--    переживає зміну пристрою і не може розійтися з реальністю.
-- ============================================================================
