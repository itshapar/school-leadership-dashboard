import { createSupabaseServerClient } from "@/lib/supabase/server";
import TotalDashboardClient from "@/components/Admin/TotalDashboardClient";
import { buildClassCodeMap } from "@/lib/classCodes";

export const dynamic = "force-dynamic";

export default async function TotalDashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Fetch students and classes in parallel
  const [
    { data: students, error: stError },
    { data: classes, error: clError }
  ] = await Promise.all([
    supabase.from("students").select("id, full_name, avatar_emoji, class_id"),
    supabase.from("classes").select("id, name")
  ]);

  if (stError || clError) {
    console.error("Database error in TotalDashboard:", stError || clError);
    throw new Error("Failed to load dashboard data");
  }

  // Fetch all star entries in pages of 1000 to bypass default query limits
  let allEntries: { student_id: string | null; amount: number }[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: chunk, error: enError } = await supabase
      .from("star_entries")
      .select("student_id, amount")
      .range(from, from + limit - 1);

    if (enError) {
      console.error("Database error in TotalDashboard star_entries fetch:", enError);
      throw new Error("Failed to load dashboard data");
    }

    if (chunk && chunk.length > 0) {
      allEntries = allEntries.concat(chunk);
      from += limit;
      if (chunk.length < limit) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  // Map class names for quick lookup
  const classMap: Record<string, string> = {};
  (classes ?? []).forEach((c) => {
    classMap[c.id] = c.name;
  });

  const codeMap = buildClassCodeMap(classes ?? []);

  // Aggregate star totals
  const starTotals: Record<string, number> = {};
  allEntries.forEach((entry) => {
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
    classCode: codeMap[st.class_id] ?? st.class_id,
    totalStars: starTotals[st.id] ?? 0,
  }));

  return <TotalDashboardClient initialData={formattedData} />;
}

