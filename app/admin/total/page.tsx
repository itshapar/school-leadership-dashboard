import { createSupabaseServerClient } from "@/lib/supabase/server";
import TotalDashboardClient from "@/components/Admin/TotalDashboardClient";

export const dynamic = "force-dynamic";

export default async function TotalDashboardPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch all students with their class names
  const { data: studentsData } = await supabase
    .from("students")
    .select(`
      id, 
      full_name, 
      avatar_emoji, 
      classes (
        name
      )
    `);

  // 2. Fetch all star entries to calculate totals
  // We fetch everything and aggregate here because a complex join/group by in Supabase 
  // can be slower or more complex to write with the current schema
  const { data: entriesData } = await supabase
    .from("star_entries")
    .select("student_id, amount");

  const starTotals: Record<string, number> = {};
  (entriesData ?? []).forEach((entry) => {
    if (entry.student_id && entry.amount > 0) {
      starTotals[entry.student_id] = (starTotals[entry.student_id] ?? 0) + entry.amount;
    }
  });

  const formattedData = (studentsData ?? []).map((st: any) => ({
    id: st.id,
    full_name: st.full_name,
    avatar_emoji: st.avatar_emoji,
    className: st.classes?.name ?? "Невідомо",
    totalStars: starTotals[st.id] ?? 0,
  }));

  return <TotalDashboardClient initialData={formattedData} />;
}
