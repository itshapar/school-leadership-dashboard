"use client";

import { App, ConfigProvider } from "antd";
import { IconContext } from "@phosphor-icons/react";

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
          // Побічний ефект чорного colorPrimary (живий фідбек): підсвітка
          // опції під курсором у Select/Dropdown/Menu за замовчуванням теж
          // бралась від colorPrimary (раніше м'який блакитний відтінок, тепер
          // важкий чорний з білим текстом). Нейтральний сірий тут — саме для
          // цієї підсвітки, не для чекбоксів/кнопок.
          controlItemBgHover: "#f1f3f5",
          controlItemBgActive: "#f1f3f5",
          controlItemBgActiveHover: "#e9ecef",
        },
        components: {
          // Чекбокси нагород у журналі (ManagementTable) навмисно зелені —
          // це той самий colorPrimary, що визначає й ховер/фокус, тож
          // сайтовий чорний colorPrimary вище випадково чорнив і їх (живий
          // фідбек). Токен саме на Checkbox, а не глобальний CSS-патч.
          Checkbox: {
            // Той самий зелений, що й підсумок "За урок" у журналі
            // (ManagementTable) і всюди в інтерфейсі — живий фідбек,
            // єдиний зелений на весь сайт замість кількох відтінків.
            colorPrimary: "#20C31A",
            colorPrimaryHover: "#429e15",
          },
        },
      }}
    >
      {/* Phosphor: усі іконки в інтерфейсі — bold, одним місцем замість
          weight="bold" на кожному використанні (живий фідбек). size:"1.15em"
          — трохи більше за текст навколо, інакше в кнопках з текстом іконка
          губилась поруч із капсом. Без явного size деякі SVG взагалі
          рендерились 0×0 (невидимі) — власний дефолт бібліотеки на розмір
          не завжди підхоплювався. */}
      <IconContext.Provider value={{ weight: "bold", size: "1.15em" }}>
        <App>{children}</App>
      </IconContext.Provider>
    </ConfigProvider>
  );
}
