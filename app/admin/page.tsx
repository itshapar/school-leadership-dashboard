import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { UserOutlined, ReadOutlined, StarFilled } from "@ant-design/icons";
import { Progress } from "antd";
import { buildClassCodeMap } from "@/lib/classCodes";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, game_day_threshold, pizza_day_threshold")
    .order("name");
  const classList = classes ?? [];
  const codeMap = buildClassCodeMap(classList);

  // Per-class star totals
  const classData = await Promise.all(
    classList.map(async (cls) => {
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", cls.id);

      const { data: entries } = await supabase
        .from("star_entries")
        .select("amount")
        .eq("class_id", cls.id);

      const totalStars = (entries ?? []).reduce((s, e) => s + e.amount, 0);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id")
        .eq("class_id", cls.id);

      return {
        ...cls,
        studentCount: students?.length ?? 0,
        totalStars,
        lessonCount: lessons?.length ?? 0,
      };
    })
  );

  return (
    <div className="page-container" style={{ maxWidth: "800px", paddingBottom: "80px" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-1px" }}>
          Список класів
        </h1>
      </div>

      <div className="admin-class-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {classData.map((cls) => {
          return (
            <div key={cls.id} className="star-card" style={{ padding: "0", overflow: "hidden" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                gap: "24px",
                padding: "20px",
                flexWrap: "wrap"
              }}>
                <div style={{ 
                  flex: "1 1 300px", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "32px",
                  flexWrap: "wrap"
                }}>
                  <div style={{ 
                    fontSize: "1.8rem", 
                    fontWeight: 900, 
                    color: "var(--color-text)", 
                    minWidth: "150px"
                  }}>
                    {cls.name}
                  </div>
                  
                  <div style={{ 
                    display: "flex", 
                    gap: "24px", 
                    fontSize: "1rem", 
                    fontWeight: 800, 
                    color: "var(--color-text-muted)",
                    alignItems: "center"
                  }}>
                    <span>{cls.studentCount} учнів</span>
                    <span>{cls.lessonCount} уроків</span>
                    <span style={{ color: "var(--color-star)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {cls.totalStars} <StarFilled style={{ fontSize: "0.9rem" }} />
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: "0 0 auto" }}>
                  <Link
                    href={`/admin/${codeMap[cls.id]}`}
                    style={{
                      padding: "10px 24px",
                      background: "#000000",
                      color: "white",
                      borderRadius: "12px",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      border: "3px solid #000000",
                      boxShadow: "4px 4px 0px #000000",
                      textTransform: "uppercase",
                      textAlign: "center",
                      minWidth: "120px"
                    }}
                  >
                    Журнал
                  </Link>
                  <Link
                    href={`/class/${codeMap[cls.id]}`}
                    target="_blank"
                    style={{
                      padding: "10px 24px",
                      background: "#FFFFFF",
                      border: "3px solid var(--color-border)",
                      color: "var(--color-text)",
                      borderRadius: "12px",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      boxShadow: "4px 4px 0px var(--color-border)",
                      textTransform: "uppercase",
                      textAlign: "center",
                      minWidth: "120px"
                    }}
                  >
                    Дашборд
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "48px", textAlign: "center" }}>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
