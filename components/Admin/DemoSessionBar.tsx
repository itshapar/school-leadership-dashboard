import Link from "next/link";

/**
 * Смуга демо-сесії: висить унизу на КОЖНІЙ сторінці кабінету, поки людина
 * сидить під анонімною сесією (живий фідбек: «кнопка зареєструватися має
 * постійно бути десь»).
 *
 * Рендериться з app/admin/layout.tsx, тобто і в кабінеті, і в журналі, і в
 * налаштуваннях класу, і в майстрі створення класу.
 */
export default function DemoSessionBar() {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 200,
        background: "#000000",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "#ffffff", fontWeight: 800, fontSize: "0.88rem" }}>
        Демо-режим. Усе працює по-справжньому, але цей клас зникне разом із сесією.
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
  );
}
