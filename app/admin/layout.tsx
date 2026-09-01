import { createSupabaseServerClient } from "@/lib/supabase/server";
import DemoSessionBar from "@/components/Admin/DemoSessionBar";
import SupportButton from "@/components/Admin/SupportButton";

/**
 * Спільна обгортка кабінету. Тримає дві наскрізні речі: кнопку підтримки в
 * кутку і смугу демо-сесії внизу, поки людина зайшла анонімно (через /demo).
 *
 * Анонімність визначає сам Supabase (user.is_anonymous), а не наші кукі чи
 * параметри адреси: підробити прапорець з браузера не вийде, а отже і
 * сховати смугу, лишившись у демо, теж.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDemo = Boolean(user?.is_anonymous);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>{children}</div>
      {/* У демо кнопку підтримки піднімаємо над смугою, інакше вона сідає
          рівно на кнопку «Зареєструватися». */}
      <SupportButton bottomOffset={isDemo ? 88 : 24} />
      {isDemo && <DemoSessionBar />}
    </div>
  );
}
