import Link from "next/link";

/**
 * Екран «старий код більше не діє» (Етап 8, вимога 4).
 *
 * До Етапу 1 коди класів були 4-значними — простір перебору 10 000, тобто
 * будь-хто міг за кілька хвилин перебрати всі класи в системі. Нові коди
 * мають 10 символів (~8×10¹⁴). Старі відключено (`classes.legacy_code = NULL`),
 * і саме тому цей екран існує: дитина з торішньої роздрукованої пам'ятки не
 * має впертись у голий 404 без пояснень.
 *
 * ВАЖЛИВО: екран показується для будь-якого 4-значного коду — перевіряється
 * лише ФОРМАТ, а не існування класу. Інакше він став би оракулом «такий клас
 * є / такого немає» і повернув би рівно ту дірку, яку ми закриваємо.
 *
 * Текст — для дитини, не для юриста: що сталось і до кого підійти.
 */
export default function LegacyCodeNotice() {
  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <div
        className="star-card"
        style={{
          textAlign: "center",
          padding: "40px 24px",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px #000",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: 12 }} aria-hidden>
          🔑
        </div>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 12px", lineHeight: 1.2 }}>
          Цей код більше не діє
        </h1>

        <p style={{ margin: "0 0 20px", lineHeight: 1.6, color: "var(--color-text)" }}>
          Ми перейшли на нові, довші коди класів, так безпечніше. Попроси в
          учителя новий код класу і свій PIN.
        </p>

        <div
          style={{
            background: "#f8f9fa",
            border: "2px solid #dee2e6",
            borderRadius: 12,
            padding: "14px 16px",
            textAlign: "left",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Новий код виглядає так: <b style={{ fontFamily: "monospace" }}>ABCDE-FGHJK</b>
          <br />10 символів через дефіс, а не 4 цифри.
        </div>

        <Link href="/student" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "linear-gradient(135deg, #f5a623, #e8940f)",
              border: "3px solid #000",
              borderRadius: 12,
              fontWeight: 900,
              color: "#000",
              boxShadow: "3px 3px 0px #000",
            }}
          >
            Увійти з новим кодом
          </div>
        </Link>
      </div>
    </div>
  );
}
