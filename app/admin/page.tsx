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
            <div key={cls.id} className="star-card" style={{ padding: "0" }}>
              <div className="admin-card-row">
                <div className="admin-card-info">
                  <div className="admin-class-name">
                    {cls.name}
                  </div>
                  
                  <div className="admin-class-stats">
                    <span>{cls.studentCount} учнів</span>
                    <span>{cls.lessonCount} уроків</span>
                    <span className="admin-stars-count">
                      {cls.totalStars} <StarFilled style={{ fontSize: "0.9rem" }} />
                    </span>
                  </div>
                </div>

                <div className="admin-btn-group">
                  <Link
                    href={`/admin/${codeMap[cls.id]}`}
                    className="admin-action-btn admin-btn-black"
                  >
                    Журнал
                  </Link>
                  <Link
                    href={`/class/${codeMap[cls.id]}`}
                    target="_blank"
                    className="admin-action-btn admin-btn-white"
                  >
                    Дашборд
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
