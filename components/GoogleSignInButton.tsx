"use client";

import { useState } from "react";
import { Button } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Вхід/реєстрація через Google (Supabase OAuth, PKCE).
 * Якщо email від Google збігається з наявним підтвердженим акаунтом,
 * Supabase лінкує identity до нього — дубль не створюється.
 */
export default function GoogleSignInButton({ label }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });
    // При успіху відбувається повний redirect на Google — сюди не повернемось.
    if (error) setLoading(false);
  }

  return (
    <Button
      size="large"
      block
      icon={<GoogleOutlined />}
      loading={loading}
      onClick={onClick}
      style={{ fontWeight: 600 }}
    >
      {label ?? "Продовжити з Google"}
    </Button>
  );
}
