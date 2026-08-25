import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ManagementTable from "@/components/Admin/ManagementTable";
import AdminClassToolbar from "@/components/Admin/AdminClassToolbar";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadManagementJournalData } from "@/lib/admin/managementJournalData";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function AdminClassPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();
  const classId = cls.id;

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji, group_id")
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("full_name");

  const journalInitial = await loadManagementJournalData(supabase, classId);
  const archived = Boolean(cls.archived_at);

  return (
    <div style={{ padding: "0", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Top Header Bar */}
      <div style={{ 
        background: "#ffffff", 
        borderBottom: "3px solid var(--color-border)", 
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <BackButton href="/admin" label="Назад до кабінету" />
          <div style={{ width: "2px", height: "24px", background: "#e9ecef" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0, textTransform: "uppercase", lineHeight: 1.2 }}>
            {cls.name}
          </h1>
          {archived && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                border: "2px solid #000",
                background: "#f1f3f5",
                fontWeight: 800,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Архів
            </span>
          )}
        </div>

        <AdminClassToolbar
          classId={classId}
          classCode={cls.public_code}
          students={students ?? []}
          archived={archived}
        />
      </div>

      {archived && (
        <div
          style={{
            margin: "24px 24px 0",
            background: "#f1f3f5",
            border: "3px solid #000",
            boxShadow: "4px 4px 0px #000",
            borderRadius: 12,
            padding: "14px 20px",
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "#212529",
          }}
        >
          Семестр цього класу завершено. Журнал відкритий для перегляду:
          нарахувати бали, додати урок чи видати приз уже не вийде. Повернути
          клас у роботу можна в налаштуваннях класу.
        </div>
      )}

      {/* Full Width Table Area */}
      <div style={{ width: "100%", padding: "24px" }}>
        <div style={{ 
          background: "#ffffff", 
          borderRadius: "20px", 
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          border: "3px solid #000000",
          overflow: "hidden"
        }}>
          <ManagementTable
            key={classId}
            classId={classId}
            initialData={journalInitial}
            readOnly={archived}
          />
        </div>
      </div>
    </div>
  );
}
