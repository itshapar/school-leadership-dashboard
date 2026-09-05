import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Статистика платформи для власника продукту.
 *
 * Дані бере RPC platform_stats_full (міграція 046), і він доступний ЛИШЕ
 * ролі service_role: ані anon, ані звичайний залогінений вчитель викликати
 * його не можуть, навіть знаючи назву. Тобто захист стоїть у базі, а не лише
 * в тому, що сторінку важко вгадати.
 *
 * У числа не входять: анонімні гості демо, демо-класи і службові акаунти
 * (platform_role=admin або internal_account=true в app_metadata). Інакше
 * власний акаунт і тестовий важили б у статистиці більше за десяток
 * справжніх вчителів. Демо рахується окремим блоком, по журналу запусків.
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
    individual_list: Array<{ emoji: string | null; name: string }>;
    class_list: Array<{ emoji: string | null; name: string }>;
  };
  entry_types: Array<{ icon: string; name: string; uses: number; stars: number }>;
  weekly: Array<{ week_label: string; entries: number; stars: number }>;
  daily: Array<{ day_label: string; teachers: number; demos: number }>;
  demo: {
    sessions_24h: number;
    sessions_7d: number;
    sessions_30d: number;
    total: number;
    tracking_since: string | null;
    live_now: number;
  };
}

export async function getPlatformStats(): Promise<PlatformStats | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("platform_stats_full");
  if (error || !data) return null;
  return data as PlatformStats;
}
