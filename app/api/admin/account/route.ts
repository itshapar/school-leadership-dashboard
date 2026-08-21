import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Видалення акаунту вчителя назавжди (Етап 9.2, live-фідбек: у профілі
 * лишили лише email + це, свідомо мінімізуючи PII).
 *
 * Два кроки, бо кожен вимагає іншого рівня прав:
 *   1) hard_delete_teacher_account() — SECURITY INVOKER-стиль RPC під RLS
 *      сесії самого вчителя, чистить класи/паралелі/школи/шаблони/audit_log.
 *   2) auth.admin.deleteUser — потребує service-role, видаляє сам
 *      auth.users. teacher_profiles і terms_acceptances мають
 *      ON DELETE CASCADE на auth.users.id, тож окремо їх чистити не треба.
 */
export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: dataError } = await supabaseForRls.rpc("hard_delete_teacher_account");
  if (dataError) {
    console.error("Supabase error (hard_delete_teacher_account):", dataError);
    return NextResponse.json({ error: "Не вдалося видалити дані" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    // Дані вже стерті — акаунт лишається як порожня оболонка без класів.
    console.error("SUPABASE_SERVICE_ROLE_KEY не налаштовано — auth.users не видалено");
    return NextResponse.json(
      { error: "Дані видалено, але сам акаунт не вдалося прибрати. Зверніться до підтримки." },
      { status: 500 }
    );
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("Supabase error (auth.admin.deleteUser):", authError);
    return NextResponse.json(
      { error: "Дані видалено, але сам акаунт не вдалося прибрати. Зверніться до підтримки." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
