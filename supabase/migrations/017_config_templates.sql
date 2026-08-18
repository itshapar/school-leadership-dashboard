-- ============================================================================
-- 017_config_templates.sql
-- Етап 3 · Фаза A (адитивна) · файл 4/6
--
-- Шаблони конфігурації класу. Рішення (підтверджено Andrew 2026-08-18):
-- ТАБЛИЦЯ з jsonb-payload, а не хардкод у функції. Мотивація:
--   • системний шаблон можна змінити без нової міграції;
--   • беклог №5 (власні/спільні шаблони вчителів) відкривається безкоштовно;
--   • jsonb уникає передчасної нормалізації нутрощів шаблона.
--
-- ЄДИНИЙ свідомий виняток із правила «строго teacher_id = auth.uid()»:
-- системний рядок (teacher_id IS NULL, is_system = true) читається всіма
-- authenticated. Read-only, без персональних даних; писати/змінювати його
-- через API не може ніхто (політики нижче це виключають).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.config_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = системний
  is_system   boolean NOT NULL DEFAULT false,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (is_system = (teacher_id IS NULL))   -- системний ⇔ без власника
);

-- рівно один системний шаблон (і опора для ідемпотентного seed)
CREATE UNIQUE INDEX IF NOT EXISTS config_templates_single_system
  ON public.config_templates (is_system) WHERE is_system;
CREATE INDEX IF NOT EXISTS config_templates_teacher_idx
  ON public.config_templates (teacher_id);

-- ---------------------------------------------------------------------------
-- Seed: системний шаблон = поточна конфігурація автора.
-- (Типи Урок/Бонус/Штраф; інд. призи Кіндер/Стікери/Пін/3Д Друк; класові
--  game day 250 / pizza day 500 — канонічні значення; фактичні пороги
--  наявних класів уже перенесені як є у 016.)
-- ---------------------------------------------------------------------------
INSERT INTO public.config_templates (teacher_id, is_system, name, payload)
VALUES (NULL, true, 'Стандартний шаблон', '{
  "entry_types": [
    {"name": "Урок",  "sign": 1,  "default_amount": 1, "is_lesson_bound": true,  "icon": "⭐", "sort_order": 1},
    {"name": "Бонус", "sign": 1,  "default_amount": 1, "is_lesson_bound": false, "icon": "🎁", "sort_order": 2},
    {"name": "Штраф", "sign": -1, "default_amount": 1, "is_lesson_bound": false, "icon": "⚡", "sort_order": 3}
  ],
  "individual_prizes": [
    {"name": "Кіндер",  "stars_required": 10, "emoji": "🍬", "sort_order": 1},
    {"name": "Стікери", "stars_required": 20, "emoji": "🏷️", "sort_order": 2},
    {"name": "Пін",     "stars_required": 30, "emoji": "📍", "sort_order": 3},
    {"name": "3Д Друк", "stars_required": 50, "emoji": "📦", "sort_order": 4}
  ],
  "class_prizes": [
    {"name": "Game day",  "emoji": "🎮", "threshold": 250, "sort_order": 1},
    {"name": "Pizza day", "emoji": "🍕", "threshold": 500, "sort_order": 2}
  ]
}'::jsonb)
ON CONFLICT (is_system) WHERE is_system DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: системний шаблон — read-only для authenticated; власні — повний CRUD.
-- Anon не бачить нічого (нуль політик, нуль грантів).
-- ---------------------------------------------------------------------------
ALTER TABLE public.config_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.config_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_templates TO authenticated;

DROP POLICY IF EXISTS config_templates_select ON public.config_templates;
CREATE POLICY config_templates_select ON public.config_templates FOR SELECT TO authenticated
  USING (is_system OR teacher_id = auth.uid());
DROP POLICY IF EXISTS config_templates_insert_own ON public.config_templates;
CREATE POLICY config_templates_insert_own ON public.config_templates FOR INSERT TO authenticated
  WITH CHECK (NOT is_system AND teacher_id = auth.uid());
DROP POLICY IF EXISTS config_templates_update_own ON public.config_templates;
CREATE POLICY config_templates_update_own ON public.config_templates FOR UPDATE TO authenticated
  USING (NOT is_system AND teacher_id = auth.uid())
  WITH CHECK (NOT is_system AND teacher_id = auth.uid());
DROP POLICY IF EXISTS config_templates_delete_own ON public.config_templates;
CREATE POLICY config_templates_delete_own ON public.config_templates FOR DELETE TO authenticated
  USING (NOT is_system AND teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Застосування шаблона до класу (онбординг: «створити клас із шаблону»).
-- SECURITY INVOKER: усі INSERT-и проходять RLS вчителя — чужому класу
-- конфігурацію не наллєш. Уже наявні (за назвою) елементи пропускаються,
-- тож функцію можна кликати повторно.
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.prizes_individual (class_id, name, stars_required, emoji, sort_order)
  SELECT p_class_id, x.name, x.stars_required, x.emoji, x.sort_order
  FROM jsonb_to_recordset(coalesce(v_payload->'individual_prizes', '[]'::jsonb))
       AS x(name text, stars_required int, emoji text, sort_order int)
  WHERE NOT EXISTS (SELECT 1 FROM public.prizes_individual p
                    WHERE p.class_id = p_class_id AND lower(p.name) = lower(x.name));

  INSERT INTO public.class_prizes (class_id, name, emoji, threshold, sort_order)
  SELECT p_class_id, x.name, x.emoji, x.threshold, x.sort_order
  FROM jsonb_to_recordset(coalesce(v_payload->'class_prizes', '[]'::jsonb))
       AS x(name text, emoji text, threshold int, sort_order int)
  WHERE NOT EXISTS (SELECT 1 FROM public.class_prizes p
                    WHERE p.class_id = p_class_id
                      AND lower(p.name) = lower(x.name) AND p.deleted_at IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_class_template(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_class_template(uuid, uuid) TO authenticated;
