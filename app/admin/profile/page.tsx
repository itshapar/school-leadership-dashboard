import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/Admin/ProfileForm";

export const dynamic = "force-dynamic";

/**
 * Профіль вчителя (Етап 9.2): свідомо мінімальний — email і видалення
 * акаунту. Ім'я й назву школи прибрали з реєстрації та звідси зовсім, щоб
 * не зв'язувати особу вчителя з конкретною школою без потреби.
 */
export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="page-container" style={{ maxWidth: "560px" }}>
      <div style={{ margin: "16px 0" }}>
        <Link href="/admin" style={{ color: "inherit" }}>
          <ArrowLeftOutlined /> До кабінету
        </Link>
      </div>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 900, marginBottom: "8px" }}>
        Мій профіль
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
        Email: {user.email}
      </p>
      <ProfileForm />
    </div>
  );
}
