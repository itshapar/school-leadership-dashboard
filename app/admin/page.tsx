import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { UserOutlined, ReadOutlined, StarOutlined } from "@ant-design/icons";
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

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {classData.map((cls) => {
          const gamePercent = Math.min(100, Math.round((cls.totalStars / cls.game_day_threshold) * 100));
          const pizzaPercent = Math.min(100, Math.round((cls.totalStars / cls.pizza_day_threshold) * 100));
          return (
            <div key={cls.id} className="star-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-text)" }}>
                    {cls.name}
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", gap: "16px", fontSize: "0.85rem", fontWeight: 800 }}>
                    <span>
                      <UserOutlined /> {cls.studentCount}
                    </span>
                    <span>
                      <ReadOutlined /> {cls.lessonCount}
                    </span>
                    <span>
                      <StarOutlined /> {cls.totalStars}
                    </span>
                  </div>
                  <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>Ігровий день</div>
                    <Progress percent={gamePercent} showInfo={false} strokeColor="#1677ff" />
                    <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>Pizza Day</div>
                    <Progress percent={pizzaPercent} showInfo={false} strokeColor="#fa8c16" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Link
                    href={`/admin/${codeMap[cls.id]}`}
                    style={{
                      padding: "8px 24px",
                      background: "#000000",
                      color: "white",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      border: "2px solid var(--color-border)",
                      boxShadow: "3px 3px 0px var(--color-border)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}
                  >
                    Керувати
                  </Link>
                  <Link
                    href={`/class/${codeMap[cls.id]}`}
                    target="_blank"
                    style={{
                      padding: "8px 18px",
                      background: "#FFFFFF",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      boxShadow: "3px 3px 0px var(--color-border)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}
                  >
                    Стіна
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
