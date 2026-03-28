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
            <div key={cls.id} className="star-card admin-card" style={{ padding: "20px" }}>
              <div className="admin-card-content">
                <div className="admin-card-info">
                  <div className="admin-class-name">
                    {cls.name}
                  </div>
                  
                  <div className="admin-class-stats">
                    <span>{cls.studentCount} учнів</span>
                    <span>{cls.lessonCount} уроків</span>
                    <span className="admin-stars">
                      {cls.totalStars} <StarFilled style={{ fontSize: "0.9rem" }} />
                    </span>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <Link
                    href={`/admin/${codeMap[cls.id]}`}
                    className="admin-btn admin-btn-black"
                  >
                    Журнал
                  </Link>
                  <Link
                    href={`/class/${codeMap[cls.id]}`}
                    target="_blank"
                    className="admin-btn admin-btn-white"
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

      <style jsx>{`
        .admin-card-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }
        .admin-card-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .admin-class-name {
          font-size: 1.8rem;
          fontWeight: 900;
          color: var(--color-text);
          width: 180px;
          flex-shrink: 0;
        }
        .admin-class-stats {
          display: flex;
          gap: 24px;
          font-size: 1rem;
          font-weight: 800;
          color: var(--color-text-muted);
          align-items: center;
        }
        .admin-stars {
          color: var(--color-star);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .admin-card-actions {
          display: flex;
          gap: 12px;
        }
        .admin-btn {
          padding: 10px 24px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 800;
          text-transform: uppercase;
          transition: transform 0.1s;
        }
        .admin-btn:active {
          transform: translateY(2px);
        }
        .admin-btn-black {
          background: #000000;
          color: white;
          border: 3px solid #000000;
          box-shadow: 4px 4px 0px #000000;
        }
        .admin-btn-white {
          background: #FFFFFF;
          border: 3px solid var(--color-border);
          color: var(--color-text);
          box-shadow: 4px 4px 0px var(--color-border);
        }

        @media (max-width: 768px) {
          .admin-card-content {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }
          .admin-card-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .admin-class-name {
            width: 100%;
            font-size: 1.5rem;
          }
          .admin-class-stats {
            width: 100%;
            justify-content: flex-start;
            gap: 16px;
            font-size: 0.9rem;
          }
          .admin-card-actions {
            width: 100%;
          }
          .admin-btn {
            flex: 1;
            text-align: center;
            padding: 12px 16px;
          }
        }
      `}</style>
    </div>
  );
}
