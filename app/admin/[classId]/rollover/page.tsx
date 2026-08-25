import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadParallels } from "@/lib/admin/parallels";
import { loadSemesters } from "@/lib/admin/semesters";
import RolloverClient, {
  type RolloverStudent,
} from "@/components/Admin/ClassRollover/RolloverClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

/**
 * Перехід класу в новий семестр.
 *
 * Архівний клас сюди не пускаємо: він уже перенесений, і roll_over_class
 * усе одно відмовить. Краще повернути вчителя в налаштування, ніж показати
 * форму, яка гарантовано впаде.
 */
export default async function ClassRolloverPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();
  if (cls.archived_at) redirect(`/admin/${cls.public_code}/settings`);

  const [{ data: meta }, { data: students }, semesters, parallels] = await Promise.all([
    supabase
      .from("classes")
      .select("parallel_id, semester_id")
      .eq("id", cls.id)
      .single(),
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji")
      .eq("class_id", cls.id)
      .is("deleted_at", null)
      .order("full_name"),
    loadSemesters(supabase),
    loadParallels(supabase),
  ]);

  // Назви паралелі й семестру беремо зі списків, а не вкладеним select-ом:
  // обидва зв'язки описані КОМПОЗИТНИМ FK (id, teacher_id), і PostgREST такий
  // ембед не завжди резолвить однозначно.
  const parallelName = parallels.find((p) => p.id === meta?.parallel_id)?.name ?? null;
  const semesterName = semesters.find((s) => s.id === meta?.semester_id)?.name ?? null;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <RolloverClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
        currentSemesterId={meta?.semester_id ?? null}
        currentSemesterName={semesterName}
        parallelName={parallelName}
        students={(students ?? []) as RolloverStudent[]}
        semesters={semesters}
      />
    </div>
  );
}
