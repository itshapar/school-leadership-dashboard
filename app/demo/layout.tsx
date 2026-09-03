import type { Metadata } from "next";

/**
 * Заголовок вкладки для клієнтської сторінки: "use client" не дозволяє
 * експортувати metadata з самої сторінки, тому це робить сусідній layout.
 */
export const metadata: Metadata = {
  title: "Демо",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
