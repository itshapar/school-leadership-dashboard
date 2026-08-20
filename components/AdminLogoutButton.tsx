"use client";

import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminLogoutButton() {
  async function logout() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    // Повне перезавантаження, не router.push — той самий ризик витоку між
    // акаунтами через клієнтський Router Cache, що й на вході (login/page.tsx).
    window.location.href = "/admin/login";
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
