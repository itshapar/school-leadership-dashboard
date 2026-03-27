import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/components/AntdProvider";

export const metadata: Metadata = {
  title: "StarBoard — Дошка зірок",
  description: "Gamification dashboard для учнів 7-х класів",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
