import { createSupabaseServerClient } from "@/lib/supabase/server";
import TotalDashboardClient from "@/components/Admin/TotalDashboardClient";

export const dynamic = "force-dynamic";

export default async function TotalDashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Fetch all required data in parallel
  const [
    { data: students, error: stError },
    { data: classes, error: clError },
    { data: entries, error: enError }
  ] = await Promise.all([
    supabase.from("students").select("id, full_name, avatar_emoji, class_id"),
    supabase.from("classes").select("id, name"),
    supabase.from("star_entries").select("student_id, amount")
  ]);

  if (stError || clError || enError) {
    console.error("Database error in TotalDashboard:", stError || clError || enError);
    throw new Error("Failed to load dashboard data");
  }

  // Map class names for quick lookup
  const classMap: Record<string, string> = {};
  (classes ?? []).forEach((c) => {
    classMap[c.id] = c.name;
  });

  // Aggregate star totals
  const starTotals: Record<string, number> = {};
  (entries ?? []).forEach((entry) => {
    if (entry.student_id && entry.amount > 0) {
      starTotals[entry.student_id] = (starTotals[entry.student_id] ?? 0) + entry.amount;
    }
  });

  // Format data for the client component
  const formattedData = (students ?? []).map((st) => ({
    id: st.id,
    full_name: st.full_name,
    avatar_emoji: st.avatar_emoji,
    className: classMap[st.class_id] ?? "Невідомо",
    totalStars: starTotals[st.id] ?? 0,
  }));

  return <TotalDashboardClient initialData={formattedData} />;
}
