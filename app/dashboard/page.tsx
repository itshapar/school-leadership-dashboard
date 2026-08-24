import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/analytics";
import { loadParallels } from "@/lib/admin/parallels";
import BentoGrid from "@/components/dashboard/BentoGrid";
import Link from "next/link";
import { ArrowLeftOutlined, StarFilled } from "@ant-design/icons";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { classId?: string; parallelId?: string };
}) {
  const classId = searchParams.classId || null;
  const parallelId = searchParams.parallelId || null;
  const supabase = await createSupabaseServerClient();

  // Другий бар'єр поряд із middleware: middleware можна обійти конфігом
  // matcher-а, серверний guard — ні.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  // Назва паралелі — "1".."12" (Етап 9), сортуємо числово, інакше "10" йде
  // перед "2" за звичайним рядковим порядком з БД.
  const parallels = (await loadParallels(supabase)).sort(
    (a, b) => Number(a.name) - Number(b.name)
  );

  // Паралель без явно обраного класу — фільтр за всіма класами цієї паралелі,
  // не за одним. Один клас лишається пріоритетним, якщо обидва в URL.
  let classFilter: string | string[] | null = classId;
  if (!classId && parallelId) {
    const { data: classesInParallel } = await supabase
      .from("classes")
      .select("id")
      .eq("parallel_id", parallelId)
      .eq("is_public_demo", false)
      .is("deleted_at", null);
    classFilter = (classesInParallel ?? []).map((c) => c.id);
  }

  const data = await getDashboardData(supabase, classFilter);

  // Common styles for the KPI cards
  const kpiCardStyle = {
    flex: 1,
    minWidth: "150px",
    background: "#fff",
    border: "3px solid #000",
    padding: "16px",
    borderRadius: "12px",
    boxShadow: "4px 4px 0px #000",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    minHeight: "105px"
  };

  const kpiLabelStyle = {
    fontSize: "0.85rem",
    fontWeight: 800,
    color: "#868e96",
    textTransform: "uppercase" as const,
    marginBottom: "8px"
  };

  const kpiValueStyle = {
    fontSize: "1.8rem",
    fontWeight: 900,
    lineHeight: 1.1
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
              textShadow: "none"
            }}
          >
            <ArrowLeftOutlined />
          </Link>
          <h1 style={{ margin: 0, textTransform: "uppercase", fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-1px" }}>
            ЗАГАЛЬНИЙ ДАШБОРД
          </h1>
        </div>

        <div className="dashboard-filters">
          {parallels.length > 0 && (
            <div className="filter-row">
              <span className="filter-row-label">Паралель</span>
              <div className="class-filter">
                <Link href="/dashboard" className={`filter-btn ${!parallelId && !classId ? 'active' : ''}`}>
                  Усі паралелі
                </Link>
                {parallels.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard?parallelId=${p.id}`}
                    className={`filter-btn ${!classId && parallelId === p.id ? 'active' : ''}`}
                  >
                    {p.name} клас
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="filter-row">
            <span className="filter-row-label">Клас</span>
            <div className="class-filter">
              <Link
                href={parallelId ? `/dashboard?parallelId=${parallelId}` : "/dashboard"}
                className={`filter-btn ${!classId ? 'active' : ''}`}
              >
                Всі класи
              </Link>
              {(parallelId ? data.classes.filter((c) => c.parallel_id === parallelId) : data.classes).map(c => (
                <Link
                  key={c.id}
                  href={`/dashboard?classId=${c.id}`}
                  className={`filter-btn ${classId === c.id ? 'active' : ''}`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Всього Зірок</div>
          <div style={{ ...kpiValueStyle, color: "#f59f00", display: "flex", alignItems: "center", gap: "6px" }}>
            {data.kpi.totalClassStars} <StarFilled style={{ color: "var(--color-star, #f59f00)", fontSize: "1.5rem" }} />
          </div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Всього Учнів</div>
          <div style={{ ...kpiValueStyle, color: "#000" }}>{data.kpi.totalStudents}</div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Проведено Уроків</div>
          <div style={{ ...kpiValueStyle, color: "#000" }}>~{data.kpi.totalLessons}</div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Відвідано уроків</div>
          <div style={{ ...kpiValueStyle, color: "#40c057" }}>{data.kpi.attendedLessons}</div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Кількість пропусків</div>
          <div style={{ ...kpiValueStyle, color: "#fa5252" }}>{data.kpi.absencesCount}</div>
        </div>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Загальна відвідуваність</div>
          <div style={{ ...kpiValueStyle, color: "#228be6" }}>{data.kpi.attendanceRate}%</div>
        </div>
      </div>

      <BentoGrid data={data} classId={classId} />
    </div>
  );
}
