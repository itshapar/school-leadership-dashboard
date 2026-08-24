-- ============================================================================
-- 036_class_template_no_default_prizes.sql
--
-- apply_class_template (017) накочувала одразу при створенні класу не лише
-- систему балів (Урок/Бонус/Штраф — універсальна, це лишається), а й
-- конкретні призи-приклади автора (Кіндер/Стікери/Пін/3Д Друк, Game day/
-- Pizza day). Це й давало передчасну галочку "Нагороди виконано" в майстрі
-- онбордингу одразу після кроку "Клас", хоча вчитель ще не заходив у цей
-- крок — а самі приклади не для всіх доречні (не кожен вчитель може/хоче
-- купувати учням Кіндер-сюрпризи; живий фідбек, 2026-08-24).
--
-- Призи вчитель тепер додає сам на кроці "Нагороди" — функція більше не
-- чіпає prizes_individual/class_prizes, лише entry_types.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_class_template(
  p_class_id    uuid,
  p_template_id uuid DEFAULT NULL   -- NULL → системний шаблон
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT t.payload INTO v_payload
  FROM public.config_templates t
  WHERE (p_template_id IS NOT NULL AND t.id = p_template_id)
     OR (p_template_id IS NULL AND t.is_system);
  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'Шаблон не знайдено';
  END IF;

  INSERT INTO public.entry_types
    (class_id, name, sign, default_amount, is_lesson_bound, icon, color, sort_order)
  SELECT p_class_id,
         x.name, x.sign, x.default_amount, x.is_lesson_bound, x.icon, x.color, x.sort_order
  FROM jsonb_to_recordset(coalesce(v_payload->'entry_types', '[]'::jsonb))
       AS x(name text, sign smallint, default_amount int, is_lesson_bound boolean,
            icon text, color text, sort_order int)
  WHERE NOT EXISTS (SELECT 1 FROM public.entry_types e
                    WHERE e.class_id = p_class_id
                      AND lower(e.name) = lower(x.name) AND e.deleted_at IS NULL);
END;
$$;
