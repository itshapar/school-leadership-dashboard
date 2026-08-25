import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadSemesters } from "@/lib/admin/semesters";
import SemesterManager from "@/components/Admin/SemesterManager";

export const dynamic = "force-dynamic";

export default async function SemestersPage() {
  const supabase = await createSupabaseServerClient();

  const semesters = await loadSemesters(supabase);

  // Скільки класів у кожному семестрі: за цим числом екран вирішує, чи можна
  // видалити семестр. Порожній видаляється без наслідків, непорожній ні.
  const { data: classes } = await supabase
    .from("classes")
    .select("semester_id")
    .is("deleted_at", null)
    .eq("is_public_demo", false);

  const classCounts: Record<string, number> = {};
  (classes ?? []).forEach((c) => {
    if (c.semester_id) classCounts[c.semester_id] = (classCounts[c.semester_id] ?? 0) + 1;
  });

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <SemesterManager initialSemesters={semesters} classCounts={classCounts} />
    </div>
  );
}
