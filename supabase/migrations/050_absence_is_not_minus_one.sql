-- ============================================================================
-- 050_absence_is_not_minus_one.sql
-- «Відсутній» перестає бути мінус однією зіркою.
--
-- ЩО БУЛО НЕ ТАК. Клітинка журналу «Н» зберігалась як amount = -1, тобто
-- буквально як штраф на одну зірку. На підсумок це не впливало (049 рахує
-- її нулем), але брехня лишалась брехнею і вилазила боком:
--   • у картці учня очима вчителя пропуски показувались рядками «-1 Урок»;
--   • /stats рахував 408 пропусків як штрафи (`amount < 0`), хоча реальних
--     штрафів на платформі тридцять;
--   • код мусив відрізняти «Н» від штрафу за непрямою ознакою (lesson_id).
--
-- Тепер відсутність має власний прапорець `is_absent`, а `amount` у такої
-- клітинки просто нуль. Ознака стала прямою, і 049 більше не вгадує:
-- баланс — звичайна сума amount.
--
-- ПРО ТРИГЕР. Стару домовленість «-1 означає Н» знали кілька місць, які
-- пишуть у star_entries повз API: клон демо-пісочниці (create_demo_sandbox
-- копіює список стовпців) і сторінка «Новий урок», що робить upsert прямо
-- з браузера. Плюс під час викочування ще живі вкладки зі старим JS.
-- Замість того щоб ловити кожне з них окремо, нормалізація стоїть на вході
-- в таблицю: клітинка уроку з нулем або мінусом — це відсутність, крапка.
-- Тому клон демо і не переписується: він копіює amount = 0, а прапорець
-- йому проставить тригер.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Прапорець і перенесення наявних «Н».
-- ---------------------------------------------------------------------------

ALTER TABLE public.star_entries
  ADD COLUMN IF NOT EXISTS is_absent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.star_entries.is_absent IS
  'Клітинка журналу «Н»: учня не було. amount у такої клітинки завжди 0.';

-- Спершу знімаємо старий CHECK (amount <> 0): без цього наступний UPDATE
-- не пройде.
ALTER TABLE public.star_entries DROP CONSTRAINT IF EXISTS star_entries_amount_check;

/*
 * Два тригери на час бекфілу вимкнені, і обидва навмисно:
 *
 *  - archive_guard_trg боронить записи видалених і архівних класів від
 *    правок. Це правило для вчителя, а не для міграції: сім рядків «Н»
 *    лежать у видаленому класі, і лишити їх у старому форматі не можна,
 *    інакше вони не пройдуть новий CHECK.
 *  - audit_trg пише в audit_log, хто що змінив. У міграції auth.uid()
 *    порожній, і 408 рядків «невідомий актор» тільки засмітили б журнал,
 *    у якому шукають дії людей.
 */
ALTER TABLE public.star_entries DISABLE TRIGGER archive_guard_trg;
ALTER TABLE public.star_entries DISABLE TRIGGER audit_trg;

UPDATE public.star_entries
SET is_absent = true, amount = 0
WHERE amount < 0 AND lesson_id IS NOT NULL;

ALTER TABLE public.star_entries ENABLE TRIGGER audit_trg;
ALTER TABLE public.star_entries ENABLE TRIGGER archive_guard_trg;

-- ---------------------------------------------------------------------------
-- 2. Нові правила цілісності.
-- Нуль дозволений РІВНО для відсутності: порожні рядки-привиди, від яких
-- беріг старий CHECK, так само неможливі.
-- ---------------------------------------------------------------------------

ALTER TABLE public.star_entries
  ADD CONSTRAINT star_entries_amount_check
  CHECK ((is_absent AND amount = 0) OR (NOT is_absent AND amount <> 0));

-- Відсутність буває лише на уроці: «не був» поза журналом не має сенсу.
ALTER TABLE public.star_entries
  ADD CONSTRAINT star_entries_absent_needs_lesson
  CHECK (NOT is_absent OR lesson_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 3. Нормалізація на вході (див. «ПРО ТРИГЕР» у шапці).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.star_entries_normalize_absence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.lesson_id IS NOT NULL AND NEW.amount <= 0 THEN
    NEW.is_absent := true;
    NEW.amount    := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS star_entries_normalize_absence_trg ON public.star_entries;
CREATE TRIGGER star_entries_normalize_absence_trg
  BEFORE INSERT OR UPDATE ON public.star_entries
  FOR EACH ROW EXECUTE FUNCTION public.star_entries_normalize_absence();

-- ---------------------------------------------------------------------------
-- 4. Баланси без евристики.
-- Тіло 049, з якого зникло вгадування «мінус на уроці — це Н»: відсутність
-- тепер і так важить нуль.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.student_star_balances;
CREATE VIEW public.student_star_balances
WITH (security_invoker = true) AS
WITH run AS (
  SELECT
    e.class_id,
    e.student_id,
    e.amount,
    sum(e.amount) OVER (
      PARTITION BY e.class_id, e.student_id
      ORDER BY e.created_at, e.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS prefix_sum
  FROM public.star_entries e
  WHERE e.student_id IS NOT NULL
)
SELECT
  class_id,
  student_id,
  (sum(amount) - least(0, min(prefix_sum)))::int AS stars
FROM run
GROUP BY class_id, student_id;

COMMENT ON VIEW public.student_star_balances IS
  'Зірки учня: баланс ніколи не нижчий за нуль (міграції 049, 050).';

DROP VIEW IF EXISTS public.class_star_balances;
CREATE VIEW public.class_star_balances
WITH (security_invoker = true) AS
WITH run AS (
  SELECT
    e.class_id,
    e.amount,
    sum(e.amount) OVER (
      PARTITION BY e.class_id
      ORDER BY e.created_at, e.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS prefix_sum
  FROM public.star_entries e
  WHERE e.student_id IS NULL
)
SELECT
  class_id,
  (sum(amount) - least(0, min(prefix_sum)))::int AS stars
FROM run
GROUP BY class_id;

COMMENT ON VIEW public.class_star_balances IS
  'Зірки всього класу (нарахування зі student_id IS NULL): не нижче нуля.';

REVOKE ALL ON public.student_star_balances FROM PUBLIC;
REVOKE ALL ON public.class_star_balances   FROM PUBLIC;
GRANT SELECT ON public.student_star_balances TO authenticated;
GRANT SELECT ON public.class_star_balances   TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Історія учня: пропуск ховається за прапорцем, а не за «-1».
-- Тіло 049, змінений лише рядок фільтра. Заразом зникає остання опора на
-- легасі-стовпець `type`, який 020 колись збирався дропнути.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_student_dashboard(p_code text, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class_id UUID;
  v_stars    INT;
  v_show     BOOLEAN;
  v_result   JSONB;
BEGIN
  v_class_id := public.resolve_class_by_code(p_code);
  IF v_class_id IS NULL OR p_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student_id AND s.class_id = v_class_id AND s.deleted_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT c.show_classmate_stars INTO v_show FROM classes c WHERE c.id = v_class_id;

  SELECT coalesce((SELECT b.stars FROM student_star_balances b
                   WHERE b.student_id = p_student_id), 0)
  INTO v_stars;

  SELECT jsonb_build_object(
    'class_id',    c.id,
    'class_name',  c.name,
    'public_code', c.public_code,
    'archived',    (c.archived_at IS NOT NULL),
    'show_classmate_stars', v_show,
    'student', jsonb_build_object(
      'id',           s.id,
      'display_name', public.student_display_name(s.nickname, s.full_name),
      'avatar_emoji', s.avatar_emoji
    ),
    'total_stars', v_stars,
    -- Ранг і розмір класу — тільки при увімкненому конкурентному середовищі.
    'rank', CASE WHEN v_show THEN (
      SELECT count(*)::int + 1
      FROM (
        SELECT s2.id, coalesce((SELECT b2.stars FROM student_star_balances b2
                                WHERE b2.student_id = s2.id), 0) AS stars
        FROM students s2
        WHERE s2.class_id = c.id AND s2.deleted_at IS NULL
      ) peers
      WHERE peers.stars > v_stars
    ) END,
    'total_students', CASE WHEN v_show THEN
      (SELECT greatest(count(*), 1)::int FROM students s3
       WHERE s3.class_id = c.id AND s3.deleted_at IS NULL)
    END,
    'prizes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'emoji', p.emoji,
               'stars_required', p.stars_required, 'sort_order', p.sort_order
             ) ORDER BY p.sort_order)
      FROM prizes_individual p
      WHERE p.class_id = c.id AND p.deleted_at IS NULL
    ), '[]'::jsonb),
    'given_prize_ids', coalesce((
      SELECT jsonb_agg(g.prize_id) FROM prizes_given g WHERE g.student_id = s.id
    ), '[]'::jsonb),
    'history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'amount',      h.amount,
               'type',        h.type,
               'type_name',   h.type_name,
               'type_icon',   h.type_icon,
               'note',        h.note,
               'created_at',  h.created_at,
               'occurred_on', h.occurred_on
             ) ORDER BY h.sort_at DESC)
      FROM (
        SELECT e.amount,
               e.type::text AS type,
               t.name       AS type_name,
               t.icon       AS type_icon,
               e.note, e.created_at,
               -- Урок без фільтра deleted_at навмисно: якщо урок згодом
               -- прибрали, дата, коли він БУВ, від цього не змінилась.
               l.date       AS occurred_on,
               coalesce(l.date::timestamptz, e.created_at) AS sort_at
        FROM star_entries e
        LEFT JOIN entry_types t ON t.id = e.entry_type_id
        LEFT JOIN lessons     l ON l.id = e.lesson_id
        WHERE e.student_id = s.id
          AND NOT e.is_absent
        ORDER BY coalesce(l.date::timestamptz, e.created_at) DESC
        LIMIT 30
      ) h
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_student_id;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Демо «вигляд вчителя»: та сама історія, той самий фільтр.
-- Тіло 049 (яке успадкувало 031), змінений лише рядок фільтра. Без цього
-- у публічному демо пропуски світилися б рядками з нулем.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_demo_teacher_view(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_class_id UUID;
  v_result   JSONB;
BEGIN
  SELECT c.id INTO v_class_id
  FROM classes c
  WHERE c.public_code = public.normalize_class_code(p_code)
    AND c.is_public_demo = true
    AND c.deleted_at IS NULL;

  IF v_class_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'class_id',    c.id,
    'name',        c.name,
    'public_code', c.public_code,
    'lessons', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'date', l.date) ORDER BY l.date)
      FROM lessons l
      WHERE l.class_id = c.id AND l.deleted_at IS NULL
    ), '[]'::jsonb),
    'students', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           x.id,
               'display_name', x.display_name,
               'avatar_emoji', x.avatar_emoji,
               'total_stars',  x.total_stars,
               'history',      x.history
             ) ORDER BY x.display_name)
      FROM (
        SELECT
          s.id,
          public.student_display_name(s.nickname, s.full_name) AS display_name,
          s.avatar_emoji,
          coalesce((SELECT b.stars FROM student_star_balances b
                    WHERE b.student_id = s.id), 0) AS total_stars,
          coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                     'amount', e.amount,
                     'type_name', t.name,
                     'type_icon', t.icon,
                     'note', e.note,
                     'lesson_date', l.date,
                     'created_at', e.created_at
                   ) ORDER BY e.created_at DESC)
            FROM star_entries e
            LEFT JOIN entry_types t ON t.id = e.entry_type_id
            LEFT JOIN lessons l ON l.id = e.lesson_id
            WHERE e.student_id = s.id
              AND NOT e.is_absent
          ), '[]'::jsonb) AS history
        FROM students s
        WHERE s.class_id = c.id AND s.deleted_at IS NULL
      ) x
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM classes c
  WHERE c.id = v_class_id;

  RETURN v_result;
END;
$$;

COMMIT;
