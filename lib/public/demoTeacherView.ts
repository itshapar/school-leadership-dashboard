import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Погляд вчителя" на публічний демо-клас (Етап 9) — список учнів з повною
 * історією нарахувань, без PIN-логіну. RPC сама перевіряє is_public_demo,
 * тож цей код не потребує додаткової перевірки коду класу.
 */

export interface DemoHistoryEntry {
  amount: number;
  type_name: string | null;
  type_icon: string | null;
  note: string | null;
  lesson_date: string | null;
  created_at: string;
}

export interface DemoStudent {
  id: string;
  display_name: string;
  avatar_emoji: string;
  total_stars: number;
  history: DemoHistoryEntry[];
}

export interface DemoTeacherView {
  class_id: string;
  name: string;
  public_code: string;
  lessons: Array<{ id: string; date: string }>;
  students: DemoStudent[];
}

export async function getDemoTeacherView(code: string): Promise<DemoTeacherView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_demo_teacher_view", {
    p_code: code,
  });
  if (error || !data) return null;
  return data as DemoTeacherView;
}
