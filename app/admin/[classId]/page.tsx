import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ManagementTable from "@/components/Admin/ManagementTable";
import AdminClassToolbar from "@/components/Admin/AdminClassToolbar";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadManagementJournalData } from "@/lib/admin/managementJournalData";

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
    .select("id, full_name, nickname, avatar_emoji")
    .eq("class_id", classId)
    .order("full_name");

  const journalInitial = await loadManagementJournalData(supabase, classId);

  return (
    <div style={{ padding: "0", minHeight: "100vh", background: "#f8f9fa" }}>
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
          <Link
            href="/admin"
            style={{
              background: "#000000",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              textDecoration: "none",
              fontSize: "1.1rem",
              boxShadow: "3px 3px 0px rgba(0,0,0,0.2)"
            }}
          >
            <ArrowLeftOutlined />
          </Link>
          <div style={{ width: "2px", height: "24px", background: "#e9ecef" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0, textTransform: "uppercase" }}>{cls.name}</h1>
        </div>

        <AdminClassToolbar classId={classId} students={students ?? []} />
      </div>

      {/* Full Width Table Area */}
      <div style={{ width: "100%", padding: "24px" }}>
        <div style={{ 
          background: "#ffffff", 
          borderRadius: "20px", 
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          border: "3px solid #000000",
          overflow: "hidden"
        }}>
          <ManagementTable key={classId} classId={classId} initialData={journalInitial} />
        </div>
      </div>
    </div>
  );
}
