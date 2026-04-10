"use client";

import { useState } from "react";
import { Button, Tooltip } from "antd";
import { 
  TrophyOutlined, 
  HistoryOutlined, 
  TeamOutlined, 
  LineChartOutlined 
} from "@ant-design/icons";
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap", flex: 1 }}>
      <QuickBonusPenalty classId={classId} students={students} />
      
      <Tooltip title="ІСТОРІЯ">
        <Link href={`/admin/${classId}/bonus`}>
          <Button
            size="middle"
            icon={<HistoryOutlined />}
            style={{
              background: "#ffffff",
              color: "var(--color-text)",
              border: "2px solid var(--color-border)",
              fontWeight: 800,
              borderRadius: "12px",
              height: "42px",
              width: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "3px 3px 0px var(--color-border)"
            }}
          />
        </Link>
      </Tooltip>

      <NewLessonButton classId={classId} onSuccess={() => router.refresh()} />
      <DeleteLessonButton classId={classId} onSuccess={() => router.refresh()} />
      
      <Tooltip title="СПИСОК УЧНІВ">
        <Link href={`/admin/${classId}/students`}>
          <Button
            size="middle"
            icon={<TeamOutlined />}
            style={{
              background: "#ffffff",
              color: "#000",
              border: "2px solid #000",
              fontWeight: 800,
              borderRadius: "12px",
              height: "42px",
              width: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "3px 3px 0px #000"
            }}
          />
        </Link>
      </Tooltip>

      <RewardButton classId={classId} />

      <Tooltip title="ДАШБОРД">
        <Link href={`/class/${classId}`}>
          <Button
            size="middle"
            icon={<LineChartOutlined />}
            style={{
              background: "#000",
              color: "#fff",
              border: "2px solid #000",
              fontWeight: 800,
              borderRadius: "12px",
              height: "42px",
              width: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "3px 3px 0px rgba(0,0,0,0.2)"
            }}
          />
        </Link>
      </Tooltip>
    </div>
  );
}

function RewardButton({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Tooltip title="НАГОРОДИ">
        <Button
          size="middle"
          onClick={() => setOpen(true)}
          icon={<TrophyOutlined />}
          style={{
            background: "#ffffff",
            color: "var(--color-star)",
            border: "2px solid var(--color-star)",
            fontWeight: 800,
            borderRadius: "12px",
            height: "42px",
            width: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            boxShadow: "3px 3px 0px var(--color-star)"
          }}
        />
      </Tooltip>
      <RewardSettings 
        classId={classId} 
        visible={open} 
        onClose={() => setOpen(false)} 
        onSuccess={() => router.refresh()} 
      />
    </>
  );
}
