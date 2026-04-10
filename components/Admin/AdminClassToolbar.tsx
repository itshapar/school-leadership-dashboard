"use client";

import { useState } from "react";
import { Button } from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickBonusPenalty from "@/components/Admin/QuickBonusPenalty";
import NewLessonButton from "@/components/Admin/NewLessonButton";
import DeleteLessonButton from "@/components/Admin/DeleteLessonButton";
import RewardSettings from "@/components/Admin/RewardSettings";

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

      <RewardButton classId={classId} />

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

function RewardButton({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        size="middle"
        onClick={() => setOpen(true)}
        icon={<TrophyOutlined />}
        style={{
          background: "#ffffff",
          color: "var(--color-star)",
          border: "2px solid var(--color-star)",
          fontWeight: 800,
          borderRadius: "10px",
          height: "38px",
          fontSize: "0.85rem",
          boxShadow: "2px 2px 0px var(--color-star)"
        }}
      >
        НАГОРОДИ
      </Button>
      <RewardSettings 
        classId={classId} 
        visible={open} 
        onClose={() => setOpen(false)} 
        onSuccess={() => router.refresh()} 
      />
    </>
  );
}
