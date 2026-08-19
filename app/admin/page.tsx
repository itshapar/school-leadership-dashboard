import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { UserOutlined, ReadOutlined, StarFilled } from "@ant-design/icons";
import { Progress } from "antd";
import { formatClassCode } from "@/lib/classCodes";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPlatformAdmin =
    (user?.app_metadata as Record<string, unknown> | undefined)?.platform_role ===
    "admin";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, public_code, game_day_threshold, pizza_day_threshold")
    .order("name");
  const classList = classes ?? [];

  // Per-class star totals
  const classData = await Promise.all(
    classList.map(async (cls) => {
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", cls.id);

      const { data: entries } = await supabase
        .from("star_entries")
        .select("student_id, amount")
        .eq("class_id", cls.id);

      // Total class stars: sum of individual efforts (ignoring penalties <= 0) + the class pool (including all class-wide entries)
      const totalStars = (entries ?? []).reduce((s, e) => {
        if (e.student_id) {
          // Individual student entry: only count gains (matches dashboard logic)
          return s + (e.amount > 0 ? e.amount : 0);
        } else {
          // Class-wide entry: count all bonuses/penalties
          return s + e.amount;
        }
      }, 0);

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
          Адмін-панель
        </h1>
        <div style={{ marginTop: "8px", display: "flex", gap: "16px", justifyContent: "center", fontSize: "0.9rem", fontWeight: 700 }}>
          <Link href="/admin/profile" style={{ color: "inherit" }}>
            <UserOutlined /> Профіль
          </Link>
          {isPlatformAdmin && (
            <Link href="/admin/platform" style={{ color: "inherit" }}>
              <ReadOutlined /> Платформа
            </Link>
          )}
        </div>
      </div>

      <Link 
        href="/admin/total"
        className="total-dashboard-card"
        style={{ 
          display: "block", 
          textDecoration: "none", 
          marginBottom: "16px",
          transition: "transform 0.2s"
        }}
      >
        <div className="star-card" style={{ 
          background: "linear-gradient(135deg, #000000 0%, #2c2c2c 100%)", 
          color: "#ffffff",
          border: "none",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Рейтинг усіх учнів</div>
            <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>Всі учні, класична таблиця рейтингу</div>
          </div>
          <StarFilled style={{ fontSize: "2.5rem", color: "var(--color-star)" }} />
        </div>
      </Link>

      <Link 
        href="/dashboard"
        className="total-dashboard-card"
        style={{ 
          display: "block", 
          textDecoration: "none", 
          marginBottom: "32px",
          transition: "transform 0.2s"
        }}
      >
        <div className="star-card" style={{ 
          background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)", 
          color: "#000000",
          border: "3px solid #000",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Загальний дашборд</div>
            <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>Розширена статистика, цілі та графіки</div>
          </div>
          <ReadOutlined style={{ fontSize: "2.5rem", color: "#000" }} />
        </div>
      </Link>

      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", opacity: 0.5 }}>
          Класи
        </h2>
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

                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      letterSpacing: "1px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Код для учнів: {formatClassCode(cls.public_code)}
                  </div>
                </div>

                <div className="admin-btn-group">
                  <Link
                    href={`/admin/${cls.public_code}`}
                    className="admin-action-btn admin-btn-black"
                  >
                    Журнал
                  </Link>
                  <Link
                    href={`/class/${cls.public_code}`}
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
