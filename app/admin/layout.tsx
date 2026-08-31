import { createSupabaseServerClient } from "@/lib/supabase/server";
import DemoSessionBar from "@/components/Admin/DemoSessionBar";

/**
 * Спільна обгортка кабінету. Її єдина робота — тримати смугу демо-сесії
 * унизу кожної сторінки, поки людина зайшла анонімно (через /demo).
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
      {isDemo && <DemoSessionBar />}
    </div>
  );
}
