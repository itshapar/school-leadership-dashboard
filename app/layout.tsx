import type { Metadata } from "next";
import localFont from "next/font/local";
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
 * Montserrat (Cyrillic для укр. інтерфейсу) через next/font: самохоститься,
 * без зовнішнього <link> на fonts.googleapis.com. Раніше підключення жило
 * закоментованим у globals.css — Montserrat ніколи фактично не
 * завантажувався, весь текст рендерився системним sans-serif fallback-ом.
 * Змінна --font-montserrat іде і в globals.css (звичайні теги), і в
 * ConfigProvider нижче (antd-компоненти мають власний дефолтний шрифт і
 * інакше ігнорують сторінковий font-family — це і давало розбіжність,
 * найпомітнішу в журналі, де майже все — antd Table).
 */
/*
 * Файли шрифту лежать у репозиторії (app/fonts), а не тягнуться з Google
 * під час збірки. До цього був next/font/google, і раз на скількись
 * деплоїв білд падав на ньому ж: «An error occurred in next/font» —
 * збірник не достукався до fonts.googleapis.com, Vercel повертав
 * Production deployment failed, і допомагав лише повторний білд. Тепер
 * збірка ні від чого зовнішнього не залежить. Файли зроблені з
 * офіційного змінного Montserrat (google/fonts, версія 9.000, ліцензія
 * OFL поруч): по одному статичному накресленню на вагу, обрізані рівно
 * до тих самих діапазонів, що віддавав Google (latin, cyrillic,
 * cyrillic-ext), ~40 КБ кожен.
 *
 * Набір ваг навмисно звужений до 600/800/900 (живий фідбек): 400 і 700 в
 * інтерфейсі не використовуються взагалі, звичайний текст — 600,
 * заголовки й капс-кнопки — 800/900. Побічна користь: якщо десь у
 * сторонньому CSS (antd) лишиться font-weight:400 або 700, браузер
 * підбере найближчу ЗАВАНТАЖЕНУ вагу: 400 і 500 віддадуть 600, а 700
 * віддасть 800. Тобто в 600/800 навіть без окремого патча. Саме тому тут
 * три статичні файли, а не один змінний: змінний намалював би 700
 * справжнім 700 і зламав би цю домовленість.
 */
const montserrat = localFont({
  src: [
    { path: "./fonts/Montserrat-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Montserrat-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/Montserrat-900.woff2", weight: "900", style: "normal" },
  ],
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
