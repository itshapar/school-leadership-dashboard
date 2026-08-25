"use client";

import { useEffect, useState } from "react";
import { Form, Input, Button, Alert, Spin } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

/**
 * Встановлення нового пароля після переходу за листом.
 *
 * Лист із Supabase може привести сюди трьома різними способами, і саме це
 * ламало потік раніше (живий фідбек: «натискаю Reset Password і нічого не
 * відбувається»). Раніше лист вів на серверний /auth/callback, який умів
 * лише `?code=`; коли Supabase віддавав токен інакше, код не знаходився,
 * і людину мовчки викидало назад на сторінку входу. Тепер сторінка
 * розбирає всі три формати сама, у браузері:
 *
 *   1. `?code=...`        — PKCE, обмінюємо на сесію (verifier лежить у
 *                           цьому ж браузері, тому це має робити клієнт);
 *   2. `?token_hash=&type=recovery` — новий формат листів, verifyOtp;
 *   3. `#access_token=...&refresh_token=...` — implicit-формат, токени
 *      приходять у ХЕШІ, який узагалі не долітає до сервера.
 *
 * Після зміни пароля гасимо ВСІ ІНШІ сесії (scope: 'others') — якщо пароль
 * скидали через компрометацію, чужі сесії не переживуть зміну.
 * Той самий потік задає пароль і Google-акаунту без пароля.
 */
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const supabase = getSupabaseClient();
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      // Supabase кладе причину відмови і в query, і в хеш — залежно від формату.
      const errorDescription =
        params.get("error_description") ?? hash.get("error_description");

      try {
        if (errorDescription) {
          setLinkError(errorDescription);
        } else if (params.get("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.get("code")!);
          if (error) setLinkError(error.message);
        } else if (params.get("token_hash")) {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: params.get("token_hash")!,
          });
          if (error) setLinkError(error.message);
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) setLinkError(error.message);
        }
      } catch {
        setLinkError("Посилання не вдалося опрацювати");
      }

      // Токени з адреси прибираємо: далі вони не потрібні, а в історії
      // браузера їм робити нічого.
      if (url.search || url.hash) {
        window.history.replaceState({}, "", "/reset-password");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted) {
        setHasSession(!!user);
        setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onFinish(values: { password: string }) {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setError(
        "Не вдалося змінити пароль. Мінімум 8 символів; паролі з відомих витоків не приймаються."
      );
      setLoading(false);
      return;
    }
    await supabase.auth.signOut({ scope: "others" });
    setDone(true);
    setLoading(false);
    setTimeout(() => {
      window.location.href = "/admin";
    }, 1200);
  }

  return (
    <AuthShell title="Новий пароль">
      {checking ? (
        <div style={{ textAlign: "center", padding: "24px" }}>
          <Spin />
        </div>
      ) : done ? (
        <Alert type="success" showIcon message="Пароль змінено. Переходимо в кабінет…" />
      ) : !hasSession ? (
        <>
          <Alert
            type="warning"
            showIcon
            message="Посилання недійсне або протерміноване"
            description={
              linkError
                ? `Причина: ${linkError}. Запросіть нове посилання.`
                : "Запросіть нове посилання і відкрийте його на цьому ж пристрої."
            }
            style={{ marginBottom: 16 }}
          />
          <Link href="/forgot-password">
            <Button block className="btn-primary">
              Запросити нове посилання
            </Button>
          </Link>
        </>
      ) : (
        <>
          {error && (
            <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
          )}
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 600 }}>Новий пароль</span>}
              rules={[
                { required: true, message: "Введіть новий пароль" },
                { min: 8, message: "Мінімум 8 символів" },
              ]}
            >
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className="btn-primary">
              Зберегти пароль
            </Button>
          </Form>
        </>
      )}
    </AuthShell>
  );
}
