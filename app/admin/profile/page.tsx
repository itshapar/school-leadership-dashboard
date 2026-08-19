import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/Admin/ProfileForm";

export const dynamic = "force-dynamic";

/** Профіль вчителя (PRD §5.1): ім'я + назва школи для відображення. */
export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("id, display_name, school_display_name")
    .eq("id", user.id)
    .maybeSingle();

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
      <div className="star-card">
        <ProfileForm
          profile={
            profile ?? { id: user.id, display_name: "", school_display_name: null }
          }
        />
      </div>
    </div>
  );
}
