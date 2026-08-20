import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
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

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, avatar_emoji, group_id")
    .eq("class_id", cls.id)
    .is("deleted_at", null)
    .order("full_name");

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      <ClassSettingsClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
        initialStudents={(students ?? []) as StudentRow[]}
      />
    </div>
  );
}
