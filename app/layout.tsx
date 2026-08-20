import type { Metadata } from "next";
import "./globals.css";
import LegalFooter from "@/components/Legal/LegalFooter";

export const metadata: Metadata = {
  title: "StarBoard — Дошка зірок",
  description: "Gamification dashboard для учнів 7-х класів",
};

/**
 * Кореневий layout.
 *
 * Футер із посиланнями на /privacy і /terms стоїть саме тут, а не в окремих
 * layout-ах кабінету: вимога Етапу 5 — документи мусять бути доступні з УСІХ
 * сторінок, включно з публічними сторінками класу, персональним дашбордом
 * учня і сторінкою входу /student.
 *
 * flex-колонка на body + margin-top:auto у футері притискають його донизу
 * навіть на коротких сторінках, не ламаючи наявні .page-container.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ flex: "1 0 auto" }}>{children}</div>
        <LegalFooter />
      </body>
    </html>
  );
}
