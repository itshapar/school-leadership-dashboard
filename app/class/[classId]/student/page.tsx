import { notFound, redirect } from "next/navigation";
import StudentPicker from "@/components/StudentPicker";
import { getPublicClassOverview } from "@/lib/public/classData";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function StudentPickerPage({ params }: Props) {
  const { classId: classParam } = await params;

  const overview = await getPublicClassOverview(classParam);
  if (!overview) return notFound();

  if (overview.requested_legacy) {
    redirect(`/class/${overview.public_code}/student`);
  }

  return (
    <StudentPicker
      classCode={overview.public_code}
      className={overview.name}
      students={(overview.students ?? []).map((s) => ({
        id: s.id,
        display_name: s.display_name,
        avatar_emoji: s.avatar_emoji,
      }))}
    />
  );
}
