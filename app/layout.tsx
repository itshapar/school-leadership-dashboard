import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import LegalFooter from "@/components/Legal/LegalFooter";
import ThemeProvider from "@/components/ThemeProvider";

/**
 * Метадані сайту.
 *
 * title.template додає « · StarBoard» до заголовка кожної сторінки, тож
 * вкладка завжди каже, і що це за сервіс, і де саме людина зараз. Раніше всі
 * вкладки називались однаково, і десять відкритих класів були нерозрізнимі.
 *
 * metadataBase потрібен, щоб відносний шлях до og-картинки перетворювався на
 * абсолютний: месенджери й соцмережі відносних адрес не розуміють і просто
 * не покажуть прев'ю.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://www.starboard.co.ua"),
  title: {
    default: "StarBoard · Дошка зірок для класу",
    template: "%s · StarBoard",
  },
  description:
    "Журнал, зірки за роботу на уроці, нагороди й рейтинг класу. Безкоштовний інструмент для вчителя.",
  applicationName: "StarBoard",
  openGraph: {
    type: "website",
    siteName: "StarBoard",
    locale: "uk_UA",
    url: "https://www.starboard.co.ua",
    title: "StarBoard · Дошка зірок для класу",
    description:
      "Журнал, зірки за роботу на уроці, нагороди й рейтинг класу. Безкоштовний інструмент для вчителя.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "StarBoard, дошка зірок для класу",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StarBoard · Дошка зірок для класу",
    description:
      "Журнал, зірки за роботу на уроці, нагороди й рейтинг класу. Безкоштовний інструмент для вчителя.",
    images: ["/og.png"],
  },
};

/**
 * Montserrat (Cyrillic для укр. інтерфейсу) через next/font: самохоститься
 * при білді, без зовнішнього <link> на fonts.googleapis.com. Раніше
 * підключення жило закоментованим у globals.css — Montserrat ніколи
 * фактично не завантажувався, весь текст рендерився системним sans-serif
 * fallback-ом. Змінна --font-montserrat іде і в globals.css (звичайні
 * теги), і в ConfigProvider нижче (antd-компоненти мають власний дефолтний
 * шрифт і інакше ігнорують сторінковий font-family — це і давало
 * розбіжність, найпомітнішу в журналі, де майже все — antd Table).
 */
/*
 * Набір ваг навмисно звужений до 600/800/900 (живий фідбек): 400 і 700 в
 * інтерфейсі не використовуються взагалі, звичайний текст — 600,
 * заголовки й капс-кнопки — 800/900. Побічна користь: якщо десь у
 * сторонньому CSS (antd) лишиться font-weight:400 або 700, браузер
 * підбере найближчу ЗАВАНТАЖЕНУ вагу: 400 і 500 віддадуть 600, а 700
 * віддасть 800. Тобто в 600/800 навіть без окремого патча.
 */
const montserrat = Montserrat({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["600", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={montserrat.variable}>
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <ThemeProvider>
          <div style={{ flex: "1 0 auto" }}>{children}</div>
          <LegalFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
