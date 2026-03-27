"use client";

import { useRouter } from "next/navigation";
import QuickBonusPenalty from "@/components/Admin/QuickBonusPenalty";
import NewLessonButton from "@/components/Admin/NewLessonButton";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export default function AdminClassToolbar({
  classId,
  students,
}: {
  classId: string;
  students: Student[];
}) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
      <QuickBonusPenalty classId={classId} students={students} />
      <NewLessonButton classId={classId} onSuccess={() => router.refresh()} />
    </div>
  );
}
