import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Статистика платформи для власника продукту.
 *
 * Дані бере RPC platform_stats_full (міграція 044), і він доступний ЛИШЕ
 * ролі service_role: ані anon, ані звичайний залогінений вчитель викликати
 * його не можуть, навіть знаючи назву. Тобто захист стоїть у базі, а не лише
 * в тому, що сторінку важко вгадати.
 *
 * Скрізь у числах виключені анонімні гості демо і демо-класи: інакше кожен
 * перегляд туторіала виглядав би як новий вчитель із класом на 12 учнів.
 */

export interface PlatformStats {
  generated_at: string;
  teachers: {
    total: number;
    new_7d: number;
    new_30d: number;
    active_7d: number;
    with_class: number;
  };
  classes: { active: number; archived: number; avg_students: number | null };
  students: { total: number; logged_in_ever: number; sessions_active: number };
  activity: {
    lessons: number;
    entries_total: number;
    entries_7d: number;
    stars_total: number;
    penalties: number;
  };
  prizes: {
    individual_defined: number;
    class_defined: number;
    given_total: number;
    top_given: Array<{ emoji: string; name: string; given: number }>;
    top_defined: Array<{ emoji: string; name: string; classes: number; avg_stars: number }>;
  };
  entry_types: Array<{ icon: string; name: string; uses: number; stars: number }>;
  weekly: Array<{ week_label: string; teachers: number; entries: number; stars: number }>;
  demo: { sessions_24h: number; sessions_7d: number; live_now: number };
}

export async function getPlatformStats(): Promise<PlatformStats | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("platform_stats_full");
  if (error || !data) return null;
  return data as PlatformStats;
}
