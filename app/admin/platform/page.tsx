import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PlatformStats {
  teachers_total: number;
  teachers_7d: number;
  classes_active: number;
  classes_archived: number;
  students_active: number;
  star_entries_total: number;
  star_entries_7d: number;
  student_sessions_active: number;
  login_fails_24h: number;
  generated_at: string;
}

interface TeacherRow {
  teacher_id: string;
  email: string;
  registered_at: string;
  last_sign_in_at: string | null;
  classes_count: number;
  students_count: number;
  entries_30d: number;
}

/**
 * Адмін платформи: ЛИШЕ агрегати без персональних даних учнів.
 * Захист подвійний: JWT-роль перевіряється тут (fast deny) і всередині
 * кожної RPC (assert_platform_admin) — сторінка не є бар'єром безпеки.
 */
export default async function PlatformPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if ((user.app_metadata as Record<string, unknown>)?.platform_role !== "admin") {
    redirect("/admin");
  }

  const [{ data: statsData }, { data: teachersData }] = await Promise.all([
    supabase.rpc("admin_platform_stats"),
    supabase.rpc("admin_teacher_overview"),
  ]);

  const stats = (statsData ?? null) as PlatformStats | null;
  const teachers = (teachersData ?? []) as TeacherRow[];

  const statCards: Array<[string, number | string]> = stats
    ? [
        ["Вчителів", stats.teachers_total],
        ["Нових за 7 днів", stats.teachers_7d],
        ["Активних класів", stats.classes_active],
        ["Архівних класів", stats.classes_archived],
        ["Учнів", stats.students_active],
        ["Записів балів", stats.star_entries_total],
        ["Записів за 7 днів", stats.star_entries_7d],
        ["Активних учнівських сесій", stats.student_sessions_active],
        ["Фейлів входу учнів за 24 год", stats.login_fails_24h],
      ]
    : [];

  return (
    <div className="page-container" style={{ maxWidth: "900px", paddingBottom: "60px" }}>
      <div style={{ margin: "16px 0" }}>
        <Link href="/admin" style={{ color: "inherit" }}>
          <ArrowLeftOutlined /> До кабінету
        </Link>
      </div>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: "4px" }}>
        Платформа
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Агрегована статистика без персональних даних учнів.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        {statCards.map(([label, value]) => (
          <div key={label} className="star-card" style={{ padding: "16px" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 900 }}>{value}</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "12px" }}>
        Вчителі
      </h2>
      <div className="star-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border, #eee)" }}>
              <th style={{ padding: "10px 12px" }}>Email</th>
              <th style={{ padding: "10px 12px" }}>Реєстрація</th>
              <th style={{ padding: "10px 12px" }}>Останній вхід</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Класи</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Учні</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Записи (30 дн)</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.teacher_id} style={{ borderBottom: "1px solid var(--color-border, #f2f2f2)" }}>
                <td style={{ padding: "10px 12px" }}>{t.email}</td>
                <td style={{ padding: "10px 12px" }}>
                  {new Date(t.registered_at).toLocaleDateString("uk-UA")}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {t.last_sign_in_at
                    ? new Date(t.last_sign_in_at).toLocaleDateString("uk-UA")
                    : "—"}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{t.classes_count}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{t.students_count}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{t.entries_30d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
