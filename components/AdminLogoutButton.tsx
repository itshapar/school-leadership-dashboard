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
      className="admin-action-btn admin-btn-white"
      style={{ cursor: "pointer", minWidth: "auto", padding: "8px 24px" }}
    >
      Вийти
    </button>
  );
}
