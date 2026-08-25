import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadParallels } from "@/lib/admin/parallels";
import ClassSettingsClient, {
  type StudentRow,
} from "@/components/Admin/ClassSettings/ClassSettingsClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function ClassSettingsPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();

  const [{ data: students }, { data: visibility }, parallels] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji, group_id")
      .eq("class_id", cls.id)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("classes")
      .select("show_classmate_stars, parallel_id")
      .eq("id", cls.id)
      .single(),
    loadParallels(supabase),
  ]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <ClassSettingsClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
        initialShowClassmateStars={Boolean(visibility?.show_classmate_stars)}
        initialParallelId={visibility?.parallel_id ?? null}
        parallels={parallels}
        initialStudents={(students ?? []) as StudentRow[]}
      />
    </div>
  );
}
