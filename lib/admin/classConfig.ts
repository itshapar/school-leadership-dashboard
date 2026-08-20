import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Конфігурація класу після Етапу 3: типи нарахувань, призи, групи.
 *
 * Замінює зашиті enum `star_type` (lesson/bonus/penalty) і два стовпці
 * `classes.game_day_threshold` / `pizza_day_threshold`. Жоден селект тут не
 * згадує легасі-полів (`legacy_type`, `legacy_source`, `star_entries.type`) —
 * саме тому міграція 020 може їх дропнути, не зачепивши фронтенд.
 *
 * Усі функції приймають SupabaseClient і працюють однаково на сервері (SSR)
 * і в браузері. Бар'єр — RLS: 4 політики з WITH CHECK на кожній таблиці
 * (міграції 014–016, 019), тож прямий запис із браузера безпечний — чужий
 * клас відсіє БД, а не застосунок.
 */

export interface EntryType {
  id: string;
  class_id: string;
  name: string;
  /** +1 нарахування, -1 списання. Це ПІДКАЗКА для UI, не CHECK на записи. */
  sign: 1 | -1;
  default_amount: number;
  is_lesson_bound: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
  deleted_at: string | null;
}

export interface ClassPrize {
  id: string;
  class_id: string;
  name: string;
  emoji: string;
  threshold: number;
  sort_order: number;
  deleted_at: string | null;
}

export interface IndividualPrize {
  id: string;
  class_id: string;
  name: string;
  emoji: string;
  stars_required: number;
  sort_order: number;
}

export interface ClassGroup {
  id: string;
  class_id: string;
  name: string;
  sort_order: number;
  deleted_at: string | null;
}

/** Ліміти з БД (міграція 019) — UI показує лічильник і глушить «＋» на межі. */
export const CLASS_LIMITS = {
  students: 60,
  entryTypes: 30,
  individualPrizes: 30,
  classPrizes: 30,
  groups: 10,
} as const;

export const TEACHER_LIMITS = {
  classes: 20,
  parallels: 30,
} as const;

const ENTRY_TYPE_COLS =
  "id, class_id, name, sign, default_amount, is_lesson_bound, icon, color, sort_order, deleted_at";
const CLASS_PRIZE_COLS =
  "id, class_id, name, emoji, threshold, sort_order, deleted_at";
const INDIVIDUAL_PRIZE_COLS =
  "id, class_id, name, emoji, stars_required, sort_order";
const CLASS_GROUP_COLS = "id, class_id, name, sort_order, deleted_at";

// ---------------------------------------------------------------------------
// Типи нарахувань
// ---------------------------------------------------------------------------

/** Активні типи класу (без прихованих), у порядку показу. */
export async function loadEntryTypes(
  supabase: SupabaseClient,
  classId: string
): Promise<EntryType[]> {
  const { data } = await supabase
    .from("entry_types")
    .select(ENTRY_TYPE_COLS)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("sort_order");
  return (data ?? []) as EntryType[];
}

/**
 * Усі типи, включно з прихованими (deleted_at IS NOT NULL).
 * Потрібні там, де рендериться ІСТОРІЯ: запис, зроблений типом, який вчитель
 * потім сховав, мусить лишатися підписаним, а не «—».
 */
export async function loadAllEntryTypes(
  supabase: SupabaseClient,
  classId: string
): Promise<EntryType[]> {
  const { data } = await supabase
    .from("entry_types")
    .select(ENTRY_TYPE_COLS)
    .eq("class_id", classId)
    .order("sort_order");
  return (data ?? []) as EntryType[];
}

/**
 * Тип, яким журнал заповнює клітинки уроків.
 *
 * Журнал — це сітка «учень × урок», тож йому потрібен РІВНО ОДИН тип,
 * прив'язаний до уроку. Якщо вчитель завів кілька — беремо перший за
 * sort_order; решта лишаються доступними в модалці нарахування.
 */
export function primaryLessonType(types: EntryType[]): EntryType | null {
  return types.find((t) => t.is_lesson_bound && !t.deleted_at) ?? null;
}

export function entryTypeLabel(type: Pick<EntryType, "name" | "icon">): string {
  return type.icon ? `${type.icon} ${type.name}` : type.name;
}

/** Знак типу, застосований до введеної вчителем величини. */
export function signedAmount(type: Pick<EntryType, "sign">, amount: number): number {
  return type.sign < 0 ? -Math.abs(amount) : Math.abs(amount);
}

// ---------------------------------------------------------------------------
// Призи
// ---------------------------------------------------------------------------

export async function loadClassPrizes(
  supabase: SupabaseClient,
  classId: string
): Promise<ClassPrize[]> {
  const { data } = await supabase
    .from("class_prizes")
    .select(CLASS_PRIZE_COLS)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("sort_order");
  return (data ?? []) as ClassPrize[];
}

export async function loadIndividualPrizes(
  supabase: SupabaseClient,
  classId: string
): Promise<IndividualPrize[]> {
  const { data } = await supabase
    .from("prizes_individual")
    .select(INDIVIDUAL_PRIZE_COLS)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("sort_order");
  return (data ?? []) as IndividualPrize[];
}

// ---------------------------------------------------------------------------
// Групи
// ---------------------------------------------------------------------------

export async function loadClassGroups(
  supabase: SupabaseClient,
  classId: string
): Promise<ClassGroup[]> {
  const { data } = await supabase
    .from("class_groups")
    .select(CLASS_GROUP_COLS)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("sort_order");
  return (data ?? []) as ClassGroup[];
}

// ---------------------------------------------------------------------------
// Видалення конфігураційних рядків
// ---------------------------------------------------------------------------

/**
 * Тип/приз/групу з історією фізично видаляти не можна — інакше запис у
 * журналі втратить підпис (для entry_types композитний FK це просто
 * заборонить). Тому: є пов'язані записи → soft delete, немає → hard delete.
 * Викликається з UI, який показує вчителю різницю у формулюванні.
 */
export async function removeEntryType(
  supabase: SupabaseClient,
  typeId: string
): Promise<{ softDeleted: boolean; error?: string }> {
  const { count } = await supabase
    .from("star_entries")
    .select("id", { count: "exact", head: true })
    .eq("entry_type_id", typeId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("entry_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", typeId);
    return { softDeleted: true, error: error?.message };
  }

  const { error } = await supabase.from("entry_types").delete().eq("id", typeId);
  return { softDeleted: false, error: error?.message };
}

export async function removeClassPrize(
  supabase: SupabaseClient,
  prizeId: string
): Promise<{ softDeleted: boolean; error?: string }> {
  const { count } = await supabase
    .from("class_prizes_given")
    .select("id", { count: "exact", head: true })
    .eq("class_prize_id", prizeId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("class_prizes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", prizeId);
    return { softDeleted: true, error: error?.message };
  }

  const { error } = await supabase.from("class_prizes").delete().eq("id", prizeId);
  return { softDeleted: false, error: error?.message };
}

export async function removeIndividualPrize(
  supabase: SupabaseClient,
  prizeId: string
): Promise<{ softDeleted: boolean; error?: string }> {
  const { count } = await supabase
    .from("prizes_given")
    .select("id", { count: "exact", head: true })
    .eq("prize_id", prizeId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("prizes_individual")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", prizeId);
    return { softDeleted: true, error: error?.message };
  }

  const { error } = await supabase
    .from("prizes_individual")
    .delete()
    .eq("id", prizeId);
  return { softDeleted: false, error: error?.message };
}

/**
 * Групу видаляємо завжди «м'яко»: композитний FK students.group_id має
 * ON DELETE SET NULL (group_id), тобто фізичне видалення тихо розкидало б
 * учнів по «без групи». Soft delete лишає склад групи відновлюваним.
 */
export async function removeClassGroup(
  supabase: SupabaseClient,
  groupId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("class_groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId);
  return { error: error?.message };
}
