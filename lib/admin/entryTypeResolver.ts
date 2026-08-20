import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Резолвер типів нарахування для серверних операцій (імпорт, демо-дані).
 *
 * Замінює зашитий enum: замість `type: 'lesson' | 'bonus' | 'penalty'`
 * серверний код питає «дай мені тип для уроку / для плюса / для мінуса»
 * і отримує id реального рядка entry_types ЦЬОГО класу.
 *
 * Якщо клас порожній (щойно створений майстром), спершу накочуємо системний
 * шаблон через apply_class_template (міграція 017) — тоді імпорт у новий клас
 * працює без окремого кроку «спершу налаштуйте бали».
 */

export interface ResolvedEntryTypes {
  lesson: string;
  positive: string;
  negative: string;
}

interface EntryTypeRow {
  id: string;
  sign: number;
  is_lesson_bound: boolean;
  sort_order: number;
}

async function fetchTypes(
  supabase: SupabaseClient,
  classId: string
): Promise<EntryTypeRow[]> {
  const { data } = await supabase
    .from("entry_types")
    .select("id, sign, is_lesson_bound, sort_order")
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("sort_order");
  return (data ?? []) as EntryTypeRow[];
}

export async function resolveEntryTypes(
  supabase: SupabaseClient,
  classId: string
): Promise<ResolvedEntryTypes | null> {
  let types = await fetchTypes(supabase, classId);

  if (types.length === 0) {
    // Ідемпотентна: наявні за назвою елементи пропускає.
    await supabase.rpc("apply_class_template", {
      p_class_id: classId,
      p_template_id: null,
    });
    types = await fetchTypes(supabase, classId);
  }

  if (types.length === 0) return null;

  const lesson = types.find((t) => t.is_lesson_bound) ?? types[0];
  const positive = types.find((t) => !t.is_lesson_bound && t.sign > 0) ?? lesson;
  const negative = types.find((t) => !t.is_lesson_bound && t.sign < 0) ?? positive;

  return { lesson: lesson.id, positive: positive.id, negative: negative.id };
}
