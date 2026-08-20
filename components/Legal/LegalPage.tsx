import Link from "next/link";
import { TERMS_VERSION } from "@/lib/legal/terms";

/**
 * Оболонка юридичних сторінок: плашка «чернетка», зміст, друкований вигляд.
 *
 * Плашка навмисно НЕ прихована в підвалі: документ у стані чернетки має
 * заявляти про це на першому екрані, інакше вчитель вважатиме його
 * перевіреним юристом.
 */

export interface LegalSection {
  id: string;
  title: string;
  /** Абзаци; рядок, що починається з «— », рендериться пунктом списку. */
  body: string[];
}

export default function LegalPage({
  title,
  subtitle,
  updated,
  sections,
}: {
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="page-container" style={{ maxWidth: 780, paddingBottom: 64 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>
          ← На головну
        </Link>
      </div>

      <div
        style={{
          background: "#fff9db",
          border: "3px solid #f59f00",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 28,
          fontWeight: 700,
          fontSize: "0.9rem",
          lineHeight: 1.5,
        }}
      >
        ⚠️ ЧЕРНЕТКА, ДО РЕВ&apos;Ю ЮРИСТА. Це робочий текст версії{" "}
        <b>{TERMS_VERSION}</b>. Він описує наміри й фактичну поведінку сервісу,
        але не проходив юридичної експертизи і може змінитися. Після рев&apos;ю
        ми попросимо прийняти оновлену версію.
      </div>

      <h1 style={{ fontSize: "2.2rem", fontWeight: 900, margin: "0 0 8px", lineHeight: 1.15 }}>
        {title}
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontWeight: 600, margin: "0 0 4px" }}>
        {subtitle}
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: "0 0 32px" }}>
        Редакція {TERMS_VERSION} · оновлено {updated}
      </p>

      <nav
        style={{
          background: "#f8f9fa",
          border: "2px solid #dee2e6",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 36,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: "0.8rem", textTransform: "uppercase", color: "#868e96", marginBottom: 10 }}>
          Зміст
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} style={{ color: "inherit", fontWeight: 600 }}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, i) => (
        <section key={section.id} id={section.id} style={{ marginBottom: 36, scrollMarginTop: 20 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: "0 0 12px" }}>
            {i + 1}. {section.title}
          </h2>
          {section.body.map((paragraph, pi) =>
            paragraph.startsWith("— ") ? (
              <p
                key={pi}
                style={{
                  margin: "0 0 8px",
                  paddingLeft: 18,
                  lineHeight: 1.65,
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", left: 0 }}>•</span>
                {paragraph.slice(2)}
              </p>
            ) : (
              <p key={pi} style={{ margin: "0 0 12px", lineHeight: 1.7 }}>
                {paragraph}
              </p>
            )
          )}
        </section>
      ))}
    </div>
  );
}
