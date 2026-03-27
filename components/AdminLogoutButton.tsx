"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  return (
    <button
      onClick={logout}
      style={{
        padding: "8px 16px",
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        color: "var(--color-text-muted)",
        cursor: "pointer",
        fontSize: "0.85rem",
      }}
    >
      Вийти
    </button>
  );
}
