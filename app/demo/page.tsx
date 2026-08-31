"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

/**
 * Вхід у демо (живий фідбек: «демо має бути такий самий інтерфейс, що і у
 * зареєстрованого вчителя, і там мають працювати всі функції»).
 *
 * Тому демо, це не окремі сторінки-вітрини, а звичайний кабінет під
 * анонімною сесією:
 *   1) signInAnonymously — Supabase видає справжню сесію без email і пароля;
 *   2) create_demo_sandbox (міграція 040) — гостю створюється ВЛАСНА копія
 *      демо-класу з учнями, уроками, нарахуваннями й виданими нагородами;
 *   3) редірект у /admin, далі все працює як у справжнього вчителя, під тим
 *      самим RLS: нарахувати зірку, додати урок, створити ще один клас.
 *
 * Нічого не зберігається «після сесії» у прямому сенсі: анонімного
 * користувача разом з усіма його даними зносить delete_stale_demo_users.
 *
 * Повторний захід сюди з тією ж сесією не плодить копій: функція повертає
 * наявну пісочницю.
 */
export default function DemoEntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React у dev монтує ефекти двічі, а нам не потрібні дві анонімні сесії.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const supabase = getSupabaseClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          const { error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
        }

        const { error: rpcError } = await supabase.rpc("create_demo_sandbox");
        if (rpcError) throw rpcError;

        // Повне перезавантаження, а не router.push: серверні сторінки мають
        // побачити свіжі куки анонімної сесії, а клієнтський Router Cache
        // Next.js тримає попередній RSC-payload до 30 секунд.
        window.location.href = "/admin";
      } catch (err) {
        console.error(err);
        setError(
          "Не вдалося підготувати демо. Спробуйте ще раз, а якщо не вийде, зареєструйтеся, це так само безкоштовно."
        );
      }
    })();
  }, [router]);

  if (error) {
    return (
      <AuthShell title="Демо не відкрилось" homeHref="/admin/login">
        <div style={{ fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>{error}</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/demo" style={{ flex: 1, minWidth: 150 }}>
            <Button block className="btn-primary">
              Спробувати ще раз
            </Button>
          </Link>
          <Link href="/register" style={{ flex: 1, minWidth: 150 }}>
            <Button block className="btn-secondary">
              Зареєструватися
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Готуємо демо" subtitle="Створюємо ваш власний клас із вигаданими учнями" homeHref="/admin/login">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["Клас 7-А", "Учні та їхні PIN-и", "Уроки, зірки й нагороди"].map((label, i) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontWeight: 600,
              opacity: 0.4,
              animation: `demoPulse 1.2s ${i * 0.25}s infinite ease-in-out`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--color-star)",
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        ))}
      </div>
      <style>{`@keyframes demoPulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }`}</style>
    </AuthShell>
  );
}
