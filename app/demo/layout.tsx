import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Демо · StarBoard",
  description: "Кабінет StarBoard із синтетичними даними, без реєстрації.",
};

/**
 * Обгортка демо: та сама смуга внизу на КОЖНІЙ сторінці демо, щоб кнопка
 * реєстрації була під рукою будь-де, а не лише на першому екрані.
 *
 * position: sticky, а не fixed: смуга не перекриває контент на коротких
 * сторінках і не ламає прокрутку журналу на телефоні.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>{children}</div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 200,
          background: "#000000",
          borderTop: "3px solid #000",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#ffffff", fontWeight: 800, fontSize: "0.88rem" }}>
          Це демо з вигаданими даними. Зміни не зберігаються.
        </span>
        <Link
          href="/register"
          style={{
            background: "var(--color-star)",
            color: "#000000",
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: "0.85rem",
            textDecoration: "none",
            padding: "10px 22px",
            borderRadius: 10,
            border: "2px solid #000",
            whiteSpace: "nowrap",
          }}
        >
          Зареєструватися
        </Link>
      </div>
    </div>
  );
}
