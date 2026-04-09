import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Claims a class for the current user if it doesn't have a teacher yet.
 * Returns true if the class is now owned by the user (either already was or just claimed).
 * Uses the provided supabase client (which should have RLS enabled and a session).
 */
export async function claimClassIfUnassigned(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if class exists and who is the teacher
  const { data: cls, error: fetchError } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!cls) return { success: false, error: "Class not found" };

  // If already assigned to someone else
  if (cls.teacher_id && cls.teacher_id !== userId) {
    return { success: false, error: "Class is owned by another teacher" };
  }

  // If already assigned to me
  if (cls.teacher_id === userId) {
    return { success: true };
  }

  // If unassigned, claim it
  const { error: updateError } = await supabase
    .from("classes")
    .update({ teacher_id: userId })
    .eq("id", classId)
    .is("teacher_id", null);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true };
}
