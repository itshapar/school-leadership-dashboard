import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadParallels, loadParallelsEnabled } from "@/lib/admin/parallels";
import { loadStudentStarBalances } from "@/lib/stars/balances";
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
    parallelsEnabled,
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
    loadParallelsEnabled(supabase),
  ]);

  if (stError || clError) {
    console.error("Database error in TotalDashboard:", stError || clError);
    throw new Error("Failed to load dashboard data");
  }

  // Підсумки — з в'юхи балансів (міграція 049): «Н» у журналі не штраф,
  // штраф віднімається, нижче нуля не опускає. Раніше рейтинг сумував тут
  // усі star_entries сам, рядком `amount > 0`, і штрафів просто не бачив.
  const starTotals = await loadStudentStarBalances(supabase);

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
      totalStars: starTotals.get(st.id) ?? 0,
    }));

  return (
    <TotalDashboardClient
      initialData={formattedData}
      parallels={parallels}
      parallelsEnabled={parallelsEnabled}
    />
  );
}

