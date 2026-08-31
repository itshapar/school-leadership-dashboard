import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChalkboardTeacher, Student, Warning } from "@phosphor-icons/react/dist/ssr";
import StarIcon from "@/components/StarIcon";
import DemoStudentList from "@/components/Demo/DemoStudentList";
import { getDemoTeacherView } from "@/lib/public/classData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Демо · StarBoard",
  description: "Демо-клас StarBoard із синтетичними даними, без реєстрації.",
};

/**
 * Демо без логіну (живий фідбек): до цього незалогінена людина бачила лише
 * вхід, реєстрацію й відновлення пароля, тобто оцінити продукт до
 * реєстрації було нічим.
 *
 * Дані беруться з public_demo_teacher_view (міграція 031). Функція жорстко
 * прив'язана до is_public_demo = true, тож сторінка не може стати вікном у
 * справжній клас, навіть якщо хтось підставить інший код.
 *
 * Тут навмисно НЕ імітується кабінет вчителя з кнопками, які нічого не
 * роблять: демо показує ті самі дані, що бачить учитель (хто скільки зірок
 * отримав і за що), і чесно каже, що це перегляд.
 */
export default async function DemoPage() {
  const view = await getDemoTeacherView();
  if (!view) return notFound();

  const totalStars = view.students.reduce((sum, s) => sum + s.total_stars, 0);
  const entries = view.students.reduce((sum, s) => sum + s.history.length, 0);

  return (
    <div className="page-container" style={{ maxWidth: "860px", paddingBottom: "80px" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <StarIcon size="1.6rem" />
          <span style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase" }}>
            StarBoard
          </span>
        </div>
        <h1
          style={{
            fontSize: "2.2rem",
            fontWeight: 900,
            margin: "12px 0 0",
            textTransform: "uppercase",
            letterSpacing: "-1px",
            lineHeight: 1.1,
          }}
        >
          Демо-клас
        </h1>
        <p style={{ margin: "8px 0 0", color: "var(--color-text-muted)", fontWeight: 600 }}>
          Вигадані учні й вигадані зірки. Дивіться скільки завгодно, тут нічого не зламати.
        </p>
      </div>

      {/* Три числа замість опису: одразу видно масштаб класу. */}
      <div
        className="star-card"
        style={{
          display: "flex",
          justifyContent: "space-around",
          textAlign: "center",
          gap: 12,
          marginBottom: "16px",
          padding: "18px 16px",
        }}
      >
        {[
          { value: view.students.length, label: "учнів" },
          { value: view.lessons.length, label: "уроків" },
          { value: totalStars, label: "зірок" },
          { value: entries, label: "нарахувань" },
        ].map((stat) => (
          <div key={stat.label}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-text-muted)", marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/class/${view.public_code}`}
        className="total-dashboard-card"
        style={{ display: "block", textDecoration: "none", marginBottom: "16px" }}
      >
        <div
          className="star-card"
          style={{
            background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)",
            color: "#000000",
            border: "3px solid #000",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase" }}>
              Дошка класу
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
              Те, що бачать діти на екрані в класі: зірки, нагороди, рейтинг
            </div>
          </div>
          <Student weight="bold" style={{ fontSize: "2.2rem", flexShrink: 0 }} />
        </div>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "28px 0 12px" }}>
        <ChalkboardTeacher weight="bold" style={{ fontSize: "1.5rem" }} />
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase" }}>
          Погляд вчителя
        </h2>
      </div>
      <p style={{ margin: "0 0 16px", color: "var(--color-text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>
        Хто скільки зірок отримав і за що. Натисніть на учня, щоб побачити всі його нарахування.
      </p>

      <DemoStudentList students={view.students} />

      <div
        className="star-card"
        style={{ marginTop: "28px", padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}
      >
        <Warning weight="bold" style={{ fontSize: "1.4rem", color: "var(--color-star)", flexShrink: 0 }} />
        <div style={{ fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.6 }}>
          Це перегляд, а не пісочниця: нарахувати зірку чи додати учня тут не можна, дані спільні
          для всіх, хто відкрив демо. Щоб вести свій клас, потрібен власний кабінет.
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: "20px", flexWrap: "wrap" }}>
        <Link href="/register" className="admin-action-btn admin-btn-black" style={{ flex: 1, minWidth: 200 }}>
          Створити свій клас
        </Link>
        <Link href="/admin/login" className="admin-action-btn admin-btn-white" style={{ flex: 1, minWidth: 200 }}>
          Увійти
        </Link>
      </div>
    </div>
  );
}
