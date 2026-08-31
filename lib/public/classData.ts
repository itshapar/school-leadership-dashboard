import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlausibleClassCode, normalizeClassCode } from "@/lib/classCodes";

/**
 * Єдина точка доступу до публічних (без логіну) даних класу.
 *
 * Усе йде через SECURITY DEFINER функції з міграції 013a. Ані anon-ключ,
 * ані браузер клієнта більше не мають прямого доступу до таблиць:
 * після 013b роль anon позбавлена і політик, і табличних GRANT-ів.
 *
 * full_name у цих типах немає навмисно — воно не залишає БД.
 */

export interface PublicStudentSummary {
  id: string;
  display_name: string;
  avatar_emoji: string;
  /** Присутнє лише коли вчитель увімкнув show_classmate_stars для класу. */
  stars?: number;
}

export interface PublicClassEntry {
  amount: number;
  note: string | null;
  created_at: string;
}

/** Класовий приз: поріг порівнюється із сумарними зірками КЛАСУ. */
export interface PublicClassPrize {
  id: string;
  name: string;
  emoji: string;
  threshold: number;
  sort_order: number;
  given_count: number;
}

export interface PublicClassOverview {
  class_id: string;
  name: string;
  public_code: string;
  /** true, якщо користувач прийшов за старим 4-значним кодом */
  requested_legacy: boolean;
  archived: boolean;
  /** Постійний публічний демо-клас (Етап 9) — показуємо банер реєстрації. */
  is_public_demo: boolean;
  /** Чи вчитель дозволив показувати бали однокласників у списку (Етап 9.2). */
  show_classmate_stars: boolean;
  /**
   * Джерело правди для порогів класу (міграція 016). Старі ключі
   * game_day_threshold / pizza_day_threshold свідомо НЕ описані тут:
   * фронтенд їх більше не читає, тому міграція 020 може їх прибрати
   * з RPC, нічого не зламавши.
   */
  class_prizes: PublicClassPrize[];
  personal_stars: number;
  class_bonus: number;
  total_stars: number;
  class_entries: PublicClassEntry[];
  students: PublicStudentSummary[];
}

/**
 * Запис історії учня.
 *
 * `type_name`/`type_icon` — назва й іконка типу нарахування (entry_types).
 * Старого ключа `type` (enum lesson/bonus/penalty) тут немає: до 020 RPC
 * віддає обидва набори, після 020 — лише нові. Фронтенд читає лише нові,
 * тому працює однаково в обох станах.
 */
export interface PublicHistoryEntry {
  amount: number;
  type_name: string | null;
  type_icon: string | null;
  note: string | null;
  created_at: string;
}

export interface PublicPrize {
  id: string;
  name: string;
  emoji: string;
  stars_required: number;
  sort_order: number;
}

export interface PublicStudentDashboard {
  class_id: string;
  class_name: string;
  public_code: string;
  student: {
    id: string;
    display_name: string;
    avatar_emoji: string;
  };
  total_stars: number;
  rank: number;
  total_students: number;
  prizes: PublicPrize[];
  given_prize_ids: string[];
  history: PublicHistoryEntry[];
}

/**
 * ПІБ однокласників — ЛИШЕ для учня, що вже увійшов за власним PIN
 * (public_class_roster, міграція 034). На відміну від PublicStudentSummary
 * вище, це НЕ доступно анонімно: функція перевіряє токен сесії всередині.
 */
export interface PublicClassRosterEntry {
  id: string;
  full_name: string;
  display_name: string;
  avatar_emoji: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicClassOverview(
  rawCode: string
): Promise<PublicClassOverview | null> {
  if (!isPlausibleClassCode(rawCode)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_class_overview", {
    p_code: normalizeClassCode(rawCode),
  });

  if (error || !data) return null;
  return data as PublicClassOverview;
}

export async function getPublicStudentDashboard(
  rawCode: string,
  studentId: string
): Promise<PublicStudentDashboard | null> {
  if (!isPlausibleClassCode(rawCode)) return null;
  if (!UUID_RE.test(studentId)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_student_dashboard", {
    p_code: normalizeClassCode(rawCode),
    p_student_id: studentId,
  });

  if (error || !data) return null;
  return data as PublicStudentDashboard;
}

/* ------------------------------------------------------------------ */
/* Демо                                                                */
/* ------------------------------------------------------------------ */

/**
 * Код постійного публічного демо-класу. Константа, а не запит до бази:
 * анонімний клієнт не має права читати таблицю classes (і правильно), а
 * заводити заради одного рядка службовий ключ на публічній сторінці, це
 * гірше, ніж тримати тут код, який і так друкується на пам'ятках.
 * Змінити можна змінною оточення, без релізу.
 */
export const DEMO_CLASS_CODE =
  process.env.NEXT_PUBLIC_DEMO_CLASS_CODE ?? "RCAC9FW68S";

export interface DemoTeacherEntry {
  amount: number;
  type_name: string | null;
  type_icon: string | null;
  note: string | null;
  lesson_date: string | null;
  created_at: string;
}

export interface DemoTeacherStudent {
  id: string;
  display_name: string;
  avatar_emoji: string;
  total_stars: number;
  history: DemoTeacherEntry[];
}

export interface DemoTeacherView {
  class_id: string;
  name: string;
  public_code: string;
  lessons: Array<{ id: string; date: string }>;
  students: DemoTeacherStudent[];
}

/**
 * «Погляд вчителя» на демо-клас: хто скільки зірок отримав і за що.
 *
 * RPC (міграція 031) сам прив'язаний до is_public_demo = true, тож підставити
 * сюди код справжнього класу і побачити чужих учнів неможливо: функція
 * поверне NULL. Саме тому сторінка /demo обходиться без логіну.
 */
export async function getDemoTeacherView(
  rawCode: string = DEMO_CLASS_CODE
): Promise<DemoTeacherView | null> {
  if (!isPlausibleClassCode(rawCode)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_demo_teacher_view", {
    p_code: normalizeClassCode(rawCode),
  });

  if (error || !data) return null;
  return data as DemoTeacherView;
}
