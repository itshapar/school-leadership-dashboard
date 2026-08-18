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
  stars: number;
}

export interface PublicClassEntry {
  amount: number;
  note: string | null;
  created_at: string;
}

export interface PublicClassOverview {
  class_id: string;
  name: string;
  public_code: string;
  /** true, якщо користувач прийшов за старим 4-значним кодом */
  requested_legacy: boolean;
  game_day_threshold: number;
  pizza_day_threshold: number;
  personal_stars: number;
  class_bonus: number;
  total_stars: number;
  class_entries: PublicClassEntry[];
  students: PublicStudentSummary[];
}

export interface PublicHistoryEntry {
  amount: number;
  type: string;
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
