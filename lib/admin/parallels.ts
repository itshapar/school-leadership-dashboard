import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Паралель — легкий необов'язковий тег класу (7 клас, 8-А тощо), без окремої
 * сторінки керування (Етап 9 прибрав "Школи та паралелі" як окремий екран —
 * школа тепер лише вільний текст у профілі вчителя, teacher_profiles.school_display_name).
 *
 * Паралель і далі окремий рядок у таблиці parallels (потрібен для фільтра
 * рейтингу/дашборду за паралеллю), але створюється "на льоту" з поля вводу
 * класу — тут немає CRUD-екрана, лише читання списку й upsert за назвою.
 */

export interface Parallel {
  id: string;
  name: string;
  sort_order: number;
}

export async function loadParallels(supabase: SupabaseClient): Promise<Parallel[]> {
  const { data } = await supabase
    .from("parallels")
    .select("id, name, sort_order")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Parallel[];
}

/** Знайти паралель за назвою (без урахування регістру) або створити нову. */
export async function upsertParallelByName(
  supabase: SupabaseClient,
  name: string
): Promise<{ id: string | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { id: null };

  const { data: existing } = await supabase
    .from("parallels")
    .select("id")
    .is("deleted_at", null)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Сесія завершилась" };

  const { data: created, error } = await supabase
    .from("parallels")
    .insert({ name: trimmed, teacher_id: user.id })
    .select("id")
    .single();
  if (error || !created) return { id: null, error: error?.message ?? "Помилка" };
  return { id: created.id };
}

export async function setClassParallel(
  supabase: SupabaseClient,
  classId: string,
  parallelId: string | null
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("classes")
    .update({ parallel_id: parallelId, school_id: null })
    .eq("id", classId);
  return { error: error?.message };
}

// ---------------------------------------------------------------------------
// Вимикач паралелей (міграція 048)
// ---------------------------------------------------------------------------

/**
 * Чи користується вчитель паралелями взагалі.
 *
 * Паралель має сенс у школі. У закладах без паралелей (студії, курси, гуртки,
 * там просто групи) поле лише заважає, тому вчитель вимикає його в профілі, і
 * тоді зникає і поле при створенні класу, і фільтри за паралеллю.
 *
 * Дефолт — true: і для нових акаунтів, і для будь-якої помилки читання. Немає
 * профілю чи впав запит, це не привід ховати від людини наявні фільтри.
 */
export async function loadParallelsEnabled(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true;

  const { data } = await supabase
    .from("teacher_profiles")
    .select("parallels_enabled")
    .eq("id", user.id)
    .maybeSingle();
  return data?.parallels_enabled ?? true;
}

export async function setParallelsEnabled(
  supabase: SupabaseClient,
  enabled: boolean
): Promise<{ error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія завершилась" };

  const { error } = await supabase
    .from("teacher_profiles")
    .update({ parallels_enabled: enabled })
    .eq("id", user.id);
  return { error: error?.message };
}
