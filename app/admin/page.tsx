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
    <div className="page-container" style={{ maxWidth: "900px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800 }}>⭐ StarBoard Admin</h1>
          <p style={{ color: "var(--color-text-muted)", margin: "4px 0 0" }}>Управління класами</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <AdminLogoutButton />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {classData.map((cls) => {
          return (
            <div key={cls.id} className="star-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "32px" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--color-text)", width: "200px" }}>
                    {cls.name}
                  </div>
                  
                  <div style={{ 
                    display: "flex", 
                    gap: "24px", 
                    fontSize: "1rem", 
                    fontWeight: 800, 
                    color: "var(--color-text-muted)",
                    flexWrap: "nowrap",
                    alignItems: "center"
                  }}>
                    <div>{cls.studentCount} учнів</div>
                    <div>{cls.lessonCount} уроків</div>
                    <div style={{ color: "var(--color-star)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {cls.totalStars} <StarFilled style={{ fontSize: "0.9rem" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <Link
                    href={`/admin/${codeMap[cls.id]}`}
                    style={{
                      padding: "8px 20px",
                      background: "#000000",
                      color: "white",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      border: "2px solid #000000",
                      boxShadow: "3px 3px 0px #000000",
                      textTransform: "uppercase",
                    }}
                  >
                    Журнал
                  </Link>
                  <Link
                    href={`/class/${codeMap[cls.id]}`}
                    target="_blank"
                    style={{
                      padding: "8px 20px",
                      background: "#FFFFFF",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      boxShadow: "3px 3px 0px var(--color-border)",
                      textTransform: "uppercase",
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
    </div>
  );
}
