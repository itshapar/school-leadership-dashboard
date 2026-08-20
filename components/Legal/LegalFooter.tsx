import Link from "next/link";
import { TERMS_VERSION } from "@/lib/legal/terms";

/**
 * Футер із посиланнями на юридичні документи.
 *
 * Живе в app/layout.tsx, тобто з'являється на ВСІХ сторінках — включно з
 * публічними сторінками класу, персональним дашбордом учня і сторінкою
 * входу /student. Це вимога Етапу 5: сторінки, які бачать батьки та діти,
 * мусять вести до документів так само, як кабінет вчителя.
 *
 * Серверний компонент без стану: жодного клієнтського JS заради двох
 * посилань.
 */
export default function LegalFooter() {
  return (
    <footer
      style={{
        marginTop: "auto",
        padding: "24px 16px 32px",
        textAlign: "center",
        fontSize: "0.78rem",
        color: "var(--color-text-muted, #868e96)",
        fontWeight: 600,
      }}
    >
      <nav style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/privacy" style={{ color: "inherit" }}>
          Приватність
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" style={{ color: "inherit" }}>
          Умови
        </Link>
        <span aria-hidden>·</span>
        <span>Редакція {TERMS_VERSION}</span>
      </nav>
    </footer>
  );
}
