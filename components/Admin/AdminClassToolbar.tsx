"use client";

import { Button } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickBonusPenalty from "@/components/Admin/QuickBonusPenalty";
import NewLessonButton from "@/components/Admin/NewLessonButton";
import DeleteLessonButton from "@/components/Admin/DeleteLessonButton";

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
      
      <Link href={`/admin/${classId}/bonus`}>
        <Button
          size="large"
          style={{
            background: "#ffffff",
            color: "var(--color-text)",
            border: "2px solid var(--color-border)",
            fontWeight: 800,
            borderRadius: "10px",
            height: "44px",
            boxShadow: "3px 3px 0px var(--color-border)"
          }}
        >
          ІСТОРІЯ
        </Button>
      </Link>

      <NewLessonButton classId={classId} onSuccess={() => router.refresh()} />
      <DeleteLessonButton classId={classId} onSuccess={() => router.refresh()} />
    </div>
  );
}
