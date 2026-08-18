import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Перевіряє, що клас належить саме цьому вчителю.
 *
 * Раніше тут був `claimClassIfUnassigned`: якщо `teacher_id IS NULL`, будь-який
 * автентифікований користувач міг «привласнити» клас собі. У парі з політикою
 * `teacher_id IS NULL OR teacher_id = auth.uid()` це означало, що безхазяйні
 * класи були спільною власністю всіх залогінених. Тепер винятку немає:
 * немає власника — немає доступу.
 *
 * Це важливо ще й тому, що `api/admin/import` після цієї перевірки працює під
 * service-role ключем, який RLS не перевіряє взагалі.
 */
export async function assertClassOwnership(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!classId) return { success: false, error: "Class not specified" };

  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();

  // RLS вже відсіює чужі класи, тому найчастіше сюди прилетить просто null.
  if (error) return { success: false, error: "Permission denied" };
  if (!cls) return { success: false, error: "Class not found" };
  if (cls.teacher_id !== userId) {
    return { success: false, error: "Permission denied" };
  }

  return { success: true };
}
