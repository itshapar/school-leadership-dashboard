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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap", flex: 1 }}>
      <QuickBonusPenalty classId={classId} students={students} />
      
      <Link href={`/admin/${classId}/bonus`}>
        <Button
          size="middle"
          style={{
            background: "#ffffff",
            color: "var(--color-text)",
            border: "2px solid var(--color-border)",
            fontWeight: 800,
            borderRadius: "10px",
            height: "38px",
            fontSize: "0.85rem",
            boxShadow: "2px 2px 0px var(--color-border)"
          }}
        >
          ІСТОРІЯ
        </Button>
      </Link>

      <NewLessonButton classId={classId} onSuccess={() => router.refresh()} />
      <DeleteLessonButton classId={classId} onSuccess={() => router.refresh()} />
      
      <Link href={`/admin/${classId}/students`}>
        <Button
          size="middle"
          style={{
            background: "#ffffff",
            color: "#000",
            border: "2px solid #000",
            fontWeight: 800,
            borderRadius: "10px",
            height: "38px",
            fontSize: "0.85rem",
            boxShadow: "2px 2px 0px #000"
          }}
        >
          СПИСОК УЧНІВ
        </Button>
      </Link>

      <Link href={`/class/${classId}`}>
        <Button
          size="middle"
          style={{
            background: "#000",
            color: "#fff",
            border: "2px solid #000",
            fontWeight: 800,
            borderRadius: "10px",
            height: "38px",
            fontSize: "0.85rem",
            boxShadow: "2px 2px 0px rgba(0,0,0,0.2)"
          }}
        >
          ДАШБОРД
        </Button>
      </Link>
    </div>
  );
}
