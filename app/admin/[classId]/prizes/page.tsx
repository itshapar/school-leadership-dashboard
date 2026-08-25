import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import ClassPrizesClient from "@/components/Admin/ClassPrizesClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

/**
 * Нагороди класу окремою сторінкою (живий фідбек) — раніше це були дві
 * вкладки всередині налаштувань класу.
 */
export default async function ClassPrizesPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <ClassPrizesClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
      />
    </div>
  );
}
