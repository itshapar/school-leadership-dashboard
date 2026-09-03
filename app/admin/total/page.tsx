import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadParallels } from "@/lib/admin/parallels";
import TotalDashboardClient from "@/components/Admin/TotalDashboardClient";

export const metadata: Metadata = {
  title: "Рейтинг учнів",
};

export const dynamic = "force-dynamic";

export default async function TotalDashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Fetch students, classes and parallels in parallel
  const [
    { data: students, error: stError },
    { data: classes, error: clError },
    parallels,
  ] = await Promise.all([
    // Фільтри deleted_at додала міграція 018 — цей рейтинг тоді не оновили,
    // тож видалені учні й видалені класи лишалися у видачі.
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji, class_id")
      .is("deleted_at", null),
    // Архівні класи (завершені семестри) у рейтинг не входять: після переходу
    // 7-А → 8-А та сама дитина існує двічі, і спільний рейтинг показував би
    // її двома рядками з різними сумами. Історію минулого семестру видно на
    // дашборді самого архівного класу.
    supabase
      .from("classes")
      .select("id, name, public_code, parallel_id")
      .eq("is_public_demo", false)
      .is("deleted_at", null)
      .is("archived_at", null),
    loadParallels(supabase),
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

  const codeMap: Record<string, string> = {};
  (classes ?? []).forEach((c) => {
    codeMap[c.id] = c.public_code;
  });

  const parallelIdByClass: Record<string, string | null> = {};
  (classes ?? []).forEach((c) => {
    parallelIdByClass[c.id] = c.parallel_id;
  });

  // Aggregate star totals
  const starTotals: Record<string, number> = {};
  allEntries.forEach((entry) => {
    if (entry.student_id && entry.amount > 0) {
      starTotals[entry.student_id] = (starTotals[entry.student_id] ?? 0) + entry.amount;
    }
  });

  // Format data for the client component — лише учні класів зі списку вище
  // (демо-клас туди вже не входить, students-запит його не фільтрував).
  const formattedData = (students ?? [])
    .filter((st) => classMap[st.class_id] !== undefined)
    .map((st) => ({
      id: st.id,
      full_name: st.full_name,
      nickname: st.nickname ?? null,
      avatar_emoji: st.avatar_emoji,
      className: classMap[st.class_id],
      classCode: codeMap[st.class_id] ?? st.class_id,
      parallelId: parallelIdByClass[st.class_id] ?? null,
      totalStars: starTotals[st.id] ?? 0,
    }));

  return <TotalDashboardClient initialData={formattedData} parallels={parallels} />;
}

