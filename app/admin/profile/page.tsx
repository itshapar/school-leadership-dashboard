import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/Admin/ProfileForm";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Профіль вчителя",
};

export const dynamic = "force-dynamic";

/**
 * Профіль вчителя: зміна email, зміна пароля, видалення акаунту. Ім'я й
 * назву школи прибрали з реєстрації та звідси зовсім, щоб не зв'язувати
 * особу вчителя з конкретною школою без потреби.
 */
export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="page-container" style={{ maxWidth: "560px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0 24px" }}>
        <BackButton href="/admin" label="Назад до кабінету" />
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 900,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Профіль вчителя
        </h1>
      </div>
      <ProfileForm currentEmail={user.email ?? ""} />
    </div>
  );
}
