import { createSupabaseServerClient } from "@/lib/supabase/server";
import DemoSessionBar from "@/components/Admin/DemoSessionBar";
import SupportButtons from "@/components/Admin/SupportButtons";

/**
 * Наскрізна обв'язка сторінок вчителя: плаваючі кнопки підтримки й фідбеку
 * і смуга демо-сесії.
 *
 * Живе окремим компонентом, бо кабінет вчителя, це не одне піддерево
 * маршрутів: /admin/* і /dashboard лежать поруч, і обидва мають однакову
 * обв'язку. Дублювати перевірку сесії в двох лейаутах не варто.
 *
 * Анонімність визначає сам Supabase (user.is_anonymous), а не наші кукі:
 * підробити прапорець з браузера не вийде.
 */
export default async function TeacherChrome() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDemo = Boolean(user?.is_anonymous);

  return (
    <>
      {/* У демо кнопки піднімаємо над смугою, інакше нижня сідає рівно на
          кнопку «Зареєструватися». */}
      <SupportButtons bottomOffset={isDemo ? 88 : 24} />
      {isDemo && <DemoSessionBar />}
    </>
  );
}
