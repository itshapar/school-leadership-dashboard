"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, Flask } from "@phosphor-icons/react";
import { TUTORIAL_SHARE_URL } from "@/lib/tutorial";

/**
 * Дві дії на сторінці входу для тих, хто ще не має акаунта: подивитися
 * туторіал і спробувати демо.
 *
 * Дві окремі рівноцінні кнопки, без пояснювального тексту (живий фідбек):
 * підписи «Дивитися туторіал» і «Спробувати демо» самі кажуть, що буде, а
 * дрібний текст під ними лише розмивав обидві дії.
 *
 * Кнопка демо показується ЛИШЕ якщо в проєкті Supabase справді ввімкнено
 * анонімний вхід, бо саме на ньому тримається пісочниця (/demo →
 * signInAnonymously → create_demo_sandbox → /admin). Той самий підхід, що в
 * кнопки Google, і з тієї ж причини: краще не показати кнопку, ніж показати
 * кнопку, яка веде в помилку. Туторіал від цього не залежить і є завжди.
 */

const BUTTON: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "14px 18px",
  borderRadius: 12,
  border: "3px solid #000",
  boxShadow: "3px 3px 0px #000",
  background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)",
  color: "#000000",
  fontWeight: 900,
  fontSize: "0.95rem",
  textTransform: "uppercase",
  textDecoration: "none",
  cursor: "pointer",
};

export default function DemoEntryCard() {
  const [demoAvailable, setDemoAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setDemoAvailable(Boolean(json?.external?.anonymous_users));
      })
      .catch(() => {
        /* немає зв'язку з Supabase — просто не показуємо кнопку демо */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
      <a
        href={TUTORIAL_SHARE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={BUTTON}
      >
        <PlayCircle weight="fill" style={{ fontSize: "1.4rem", flexShrink: 0 }} />
        Дивитися туторіал
      </a>

      {demoAvailable && (
        <Link href="/demo" style={BUTTON}>
          <Flask weight="fill" style={{ fontSize: "1.4rem", flexShrink: 0 }} />
          Спробувати демо
        </Link>
      )}
    </div>
  );
}
