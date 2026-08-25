"use client";

import { useEffect, useState } from "react";
import { Button, Divider } from "antd";
import { GoogleLogo } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Вхід/реєстрація через Google (Supabase OAuth, PKCE).
 * Якщо email від Google збігається з наявним підтвердженим акаунтом,
 * Supabase лінкує identity до нього — дубль не створюється.
 *
 * Кнопка показується ЛИШЕ якщо провайдер справді увімкнений у проєкті
 * Supabase (живий фідбек). Раніше вона стояла завжди, а signInWithOAuth
 * робить повний редірект на /auth/v1/authorize — і коли провайдера немає,
 * людина опинялась на голій сторінці з JSON
 * `{"code":400,"msg":"Unsupported provider: provider is not enabled"}`.
 * Перехопити це в коді неможливо: помилку віддає вже інший домен.
 *
 * Тому питаємо публічний ендпоінт /auth/v1/settings (він віддає перелік
 * увімкнених провайдерів) і малюємо кнопку тільки тоді, коли google:true.
 * Щойно провайдера ввімкнуть у Supabase, кнопка з'явиться сама, без
 * жодних змін у коді чи змінних оточення.
 */
export default function GoogleSignInButton({
  label,
  disabled,
}: {
  label?: string;
  /** Реєстрація: кнопка неактивна, доки не позначені обидва чекбокси Умов. */
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setAvailable(Boolean(json?.external?.google));
      })
      .catch(() => {
        // Немає зв'язку з Supabase — просто не показуємо кнопку.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!available) return null;

  return (
    <>
      <Divider plain style={{ margin: "16px 0" }}>
        або
      </Divider>
      <Button
        block
        icon={<GoogleLogo weight="bold" />}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        className="btn-secondary"
      >
        {label ?? "Продовжити з Google"}
      </Button>
    </>
  );
}
