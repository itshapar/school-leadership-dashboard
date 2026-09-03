import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadParallels } from "@/lib/admin/parallels";
import type { PeriodCode } from "@/lib/admin/periods";
import RolloverClient, {
  type RolloverStudent,
} from "@/components/Admin/ClassRollover/RolloverClient";

export const metadata: Metadata = {
  title: "Перехід у новий семестр",
};

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

  const [{ data: meta }, { data: students }, parallels] = await Promise.all([
    supabase
      .from("classes")
      .select("parallel_id, period_code")
      .eq("id", cls.id)
      .single(),
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji")
      .eq("class_id", cls.id)
      .is("deleted_at", null)
      .order("full_name"),
    loadParallels(supabase),
  ]);

  // Назву паралелі беремо зі списку, а не вкладеним select-ом: зв'язок
  // описаний КОМПОЗИТНИМ FK (id, teacher_id), і PostgREST такий ембед не
  // завжди резолвить однозначно.
  const parallelName =
    parallels.find((p: { id: string; name: string }) => p.id === meta?.parallel_id)?.name ?? null;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <RolloverClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
        periodCode={meta?.period_code as PeriodCode}
        parallelName={parallelName}
        students={(students ?? []) as RolloverStudent[]}
      />
    </div>
  );
}
