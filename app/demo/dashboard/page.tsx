import { notFound } from "next/navigation";
import { getDashboardData } from "@/lib/analytics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoClasses } from "@/lib/demo/demoData";
import BentoGrid from "@/components/dashboard/BentoGrid";
import BackButton from "@/components/BackButton";
import "../../dashboard/dashboard.css";

export const dynamic = "force-dynamic";

/**
 * Демо-дашборд: той самий BentoGrid і ті самі KPI, що на /dashboard, тільки
 * зібрані по демо-класу і без логіну.
 *
 * Фільтри за паралелями й класами тут не показуємо: демо-клас один, і рядок
 * чипів із єдиним варіантом, це шум, а не інтерфейс. Усе інше, картки,
 * графіки, цілі, приходить із тих самих компонентів.
 */
export default async function DemoDashboardPage() {
  const admin = createSupabaseAdminClient();
  if (!admin) return notFound();

  const demoClasses = await getDemoClasses();
  if (demoClasses.length === 0) return notFound();

  const data = await getDashboardData(
    admin,
    demoClasses.map((c) => c.id),
    { publicDemo: true }
  );

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
    minHeight: "105px",
  };

  const kpiLabelStyle = {
    fontSize: "0.85rem",
    fontWeight: 800,
    color: "#868e96",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
  };

  const kpiValueStyle = {
    fontSize: "1.8rem",
    fontWeight: 900,
    lineHeight: 1.1,
  };

  return (
    <div className="dashboard-container">
      <div
        className="dashboard-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <BackButton href="/demo" label="Назад до кабінету" />
          <h1
            style={{
              margin: 0,
              textTransform: "uppercase",
              fontSize: "2.2rem",
              fontWeight: 900,
              letterSpacing: "-1px",
            }}
          >
            ЗАГАЛЬНИЙ ДАШБОРД
          </h1>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Всього Зірок</div>
          <div style={{ ...kpiValueStyle, color: "#f59f00" }}>{data.kpi.totalClassStars}</div>
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
          <div style={{ ...kpiValueStyle, color: "#20C31A" }}>{data.kpi.attendedLessons}</div>
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

      <BentoGrid data={data} classId={null} />
    </div>
  );
}
