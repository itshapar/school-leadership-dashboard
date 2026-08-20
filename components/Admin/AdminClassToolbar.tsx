"use client";

import { Button, Tooltip } from "antd";
import {
  HistoryOutlined,
  LineChartOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickEntry from "@/components/Admin/QuickEntry";
import NewLessonButton from "@/components/Admin/NewLessonButton";
import DeleteLessonButton from "@/components/Admin/DeleteLessonButton";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

const iconButtonStyle: React.CSSProperties = {
  fontWeight: 800,
  borderRadius: "12px",
  height: "42px",
  width: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.2rem",
};

export default function AdminClassToolbar({
  classId,
  classCode,
  students,
}: {
  classId: string;
  /** Публічний код класу — усі посилання кабінету йдуть за ним, не за UUID. */
  classCode: string;
  students: Student[];
}) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap", flex: 1 }}>
      <QuickEntry
        classId={classId}
        students={students}
        onSuccess={() => router.refresh()}
      />

      <Tooltip title="ІСТОРІЯ">
        <Link href={`/admin/${classCode}/bonus`}>
          <Button
            size="middle"
            icon={<HistoryOutlined />}
            style={{
              ...iconButtonStyle,
              background: "#ffffff",
              color: "var(--color-text)",
              border: "2px solid var(--color-border)",
              boxShadow: "3px 3px 0px var(--color-border)",
            }}
          />
        </Link>
      </Tooltip>

      <NewLessonButton classId={classId} onSuccess={() => router.refresh()} />
      <DeleteLessonButton classId={classId} onSuccess={() => router.refresh()} />

      <Tooltip title="СПИСОК УЧНІВ">
        <Link href={`/admin/${classCode}/students`}>
          <Button
            size="middle"
            icon={<TeamOutlined />}
            style={{
              ...iconButtonStyle,
              background: "#ffffff",
              color: "#000",
              border: "2px solid #000",
              boxShadow: "3px 3px 0px #000",
            }}
          />
        </Link>
      </Tooltip>

      {/* Налаштування класу замінили модалку «Нагороди»: типи нарахувань,
          обидва види призів і групи живуть тепер на одній сторінці. */}
      <Tooltip title="НАЛАШТУВАННЯ КЛАСУ">
        <Link href={`/admin/${classCode}/settings`}>
          <Button
            size="middle"
            icon={<SettingOutlined />}
            style={{
              ...iconButtonStyle,
              background: "#ffffff",
              color: "var(--color-star)",
              border: "2px solid var(--color-star)",
              boxShadow: "3px 3px 0px var(--color-star)",
            }}
          />
        </Link>
      </Tooltip>

      <Tooltip title="ДАШБОРД">
        <Link href={`/class/${classCode}`} target="_blank">
          <Button
            size="middle"
            icon={<LineChartOutlined />}
            style={{
              ...iconButtonStyle,
              background: "#000",
              color: "#fff",
              border: "2px solid #000",
              boxShadow: "3px 3px 0px rgba(0,0,0,0.2)",
            }}
          />
        </Link>
      </Tooltip>
    </div>
  );
}
