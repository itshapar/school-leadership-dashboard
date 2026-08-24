"use client";

import { ConfigProvider } from "antd";

/**
 * Клієнтська обгортка над antd ConfigProvider — сам ConfigProvider
 * використовує React Context, тож не може рендеритись прямо в кореневому
 * Server Component (app/layout.tsx) без "use client".
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
