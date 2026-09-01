import TeacherChrome from "@/components/Admin/TeacherChrome";

/**
 * Обгортка кабінету: сторінки плюс наскрізна обв'язка (кнопки підтримки й
 * фідбеку, смуга демо-сесії). Сама логіка живе в TeacherChrome, бо та сама
 * обв'язка потрібна і на /dashboard, який лежить поза /admin.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>{children}</div>
      <TeacherChrome />
    </div>
  );
}
