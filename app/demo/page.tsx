import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import AdminClassList from "@/components/Admin/AdminClassList";
import { getDemoCabinet } from "@/lib/demo/demoData";

export const dynamic = "force-dynamic";

/**
 * Демо-кабінет: та сама сторінка, що бачить зареєстрований учитель
 * (app/admin/page.tsx), з тими самими компонентами, тільки на синтетичному
 * класі й без логіну.
 *
 * Різниць рівно три, і всі вони чесні:
 *   • посилання карток ведуть у /demo, а не в /admin;
 *   • «Новий клас» і «Профіль вчителя» ведуть на реєстрацію, бо створювати
 *     щось у спільному демо немає сенсу;
 *   • картку з відеоінструкцією не показуємо, вона про власний кабінет.
 */
export default async function DemoCabinetPage() {
  const cabinet = await getDemoCabinet();
  if (!cabinet) return notFound();

  const { cards, parallels, firstPeriod } = cabinet;

  return (
    <div className="page-container" style={{ maxWidth: "860px", paddingBottom: "40px" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "2.2rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-1px",
          }}
        >
          Адмін-панель
        </h1>
        <div
          style={{
            marginTop: "8px",
            color: "var(--color-text-muted)",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Так виглядає кабінет вчителя. Клас, учні та зірки тут вигадані.
        </div>
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link href="/register" className="admin-action-btn admin-btn-white" style={{ minWidth: "auto" }}>
            Профіль вчителя
          </Link>
          <Link href="/register" className="admin-action-btn admin-btn-black" style={{ minWidth: "auto" }}>
            Новий клас
          </Link>
        </div>
      </div>

      <AdminClassList
        classes={cards}
        parallels={parallels}
        firstPeriod={firstPeriod}
        basePath="/demo"
      >
        <Link
          href="/demo/dashboard"
          className="total-dashboard-card"
          style={{
            display: "block",
            textDecoration: "none",
            marginBottom: "32px",
            transition: "transform 0.2s",
          }}
        >
          <div
            className="star-card"
            style={{
              background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)",
              color: "#000000",
              border: "3px solid #000",
              padding: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>
                Загальний дашборд
              </div>
              <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>
                За паралеллю, розширена статистика, цілі та графіки
              </div>
            </div>
            <ChartLineUp weight="bold" style={{ fontSize: "2.5rem", color: "#000" }} />
          </div>
        </Link>
      </AdminClassList>
    </div>
  );
}
