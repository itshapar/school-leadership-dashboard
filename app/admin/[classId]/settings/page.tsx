import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadParallels } from "@/lib/admin/parallels";
import { firstAvailablePeriod, type PeriodCode } from "@/lib/admin/periods";
import ClassSettingsClient from "@/components/Admin/ClassSettings/ClassSettingsClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function ClassSettingsPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();

  const [{ data: visibility }, parallels, { data: auth }, { data: ownClasses }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("show_classmate_stars, parallel_id, period_code")
        .eq("id", cls.id)
        .single(),
      loadParallels(supabase),
      supabase.auth.getUser(),
      supabase.from("classes").select("period_code").is("deleted_at", null),
    ]);

  const firstPeriod = firstAvailablePeriod(
    auth?.user?.created_at,
    (ownClasses ?? []).map((c) => c.period_code as PeriodCode)
  );

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <ClassSettingsClient
        classId={cls.id}
        classCode={cls.public_code}
        className={cls.name}
        initialShowClassmateStars={Boolean(visibility?.show_classmate_stars)}
        initialParallelId={visibility?.parallel_id ?? null}
        initialPeriod={visibility?.period_code as PeriodCode}
        firstPeriod={firstPeriod}
        archived={Boolean(cls.archived_at)}
        parallels={parallels}
      />
    </div>
  );
}
