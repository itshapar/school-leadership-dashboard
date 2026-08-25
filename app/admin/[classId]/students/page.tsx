import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import StudentManager from "@/components/Admin/StudentManager";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function AdminStudentsPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();
  const resolvedClassId = cls.id;

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji, group_id")
    .eq("class_id", resolvedClassId)
    .is("deleted_at", null)
    .order("full_name");

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <StudentManager
        classId={resolvedClassId}
        initialStudents={students ?? []}
        publicCode={cls.public_code}
        className={cls.name}
      />
    </div>
  );
}
