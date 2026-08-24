"use client";

import { App, ConfigProvider } from "antd";

/**
 * Клієнтська обгортка над antd ConfigProvider — сам ConfigProvider
 * використовує React Context, тож не може рендеритись прямо в кореневому
 * Server Component (app/layout.tsx) без "use client".
 *
 * <App> (9.13, живий фідбек) — статичні message.xxx()/notification.xxx()
 * без цієї обгортки не завжди надійно консюмять контекст (антд про це й
 * сам попереджає: "Static function can not consume context ... well").
 * Компоненти, яким потрібен message, мають брати його через App.useApp(),
 * а не статичний імпорт з "antd".
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
          // Синій — не наш колір ніде в інтерфейсі (живий фідбек): antd
          // за замовчуванням фарбує ним ховер/фокус кнопок, посилань,
          // активні Tabs/Steps. Чорний тут прибирає це в одному місці
          // замість точкових !important-патчів по кожному компоненту.
          colorPrimary: "#000000",
          colorLink: "#000000",
          colorLinkHover: "#2c2c2c",
          colorLinkActive: "#000000",
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
