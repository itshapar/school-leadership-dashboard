"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle } from "@phosphor-icons/react";

/**
 * Блок «Дивитися демо» на сторінці входу.
 *
 * Показується ЛИШЕ якщо в проєкті Supabase справді ввімкнено анонімний вхід,
 * бо саме на ньому тримається демо-пісочниця (/demo → signInAnonymously →
 * create_demo_sandbox → /admin). Той самий підхід, що й у кнопки Google
 * (components/GoogleSignInButton.tsx) і з тієї ж причини: краще не показати
 * кнопку, ніж показати кнопку, яка веде в помилку.
 *
 * Щойно провайдера ввімкнуть у дашборді, блок з'явиться сам, без релізу.
 */
export default function DemoEntryCard() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setAvailable(Boolean(json?.external?.anonymous_users));
      })
      .catch(() => {
        /* немає зв'язку з Supabase — просто не показуємо блок */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <Link href="/demo" style={{ textDecoration: "none" }}>
      <div
        className="star-card"
        style={{
          marginTop: 20,
          padding: "16px 18px",
          background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)",
          border: "3px solid #000",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
        }}
      >
        <PlayCircle weight="fill" style={{ fontSize: "2rem", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1rem" }}>
            Спробувати демо
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.82rem", opacity: 0.8 }}>
            Власний клас 7-А з вигаданими учнями, без реєстрації
          </div>
        </div>
      </div>
    </Link>
  );
}
