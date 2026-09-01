import TeacherChrome from "@/components/Admin/TeacherChrome";

/**
 * Дашборд лежить поза /admin, але це той самий кабінет вчителя, тож і
 * обв'язка та сама: підтримка, фідбек, смуга демо-сесії.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>{children}</div>
      <TeacherChrome />
    </div>
  );
}
