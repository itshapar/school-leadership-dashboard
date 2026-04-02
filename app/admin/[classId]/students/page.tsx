import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveClassIdByCode } from "@/lib/classCodes";
import StudentManager from "@/components/Admin/StudentManager";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function AdminStudentsPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const isUuidLike = /^[0-9a-f-]{36}$/i.test(classParam);
  let resolvedClassId = classParam;
  if (!isUuidLike) {
    const { data: allClasses } = await supabase.from("classes").select("id");
    const byCode = resolveClassIdByCode(allClasses ?? [], classParam);
    if (!byCode) return notFound();
    resolvedClassId = byCode;
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji")
    .eq("class_id", resolvedClassId)
    .order("full_name");

  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      <StudentManager 
        classId={resolvedClassId} 
        initialStudents={students ?? []} 
      />
    </div>
  );
}
