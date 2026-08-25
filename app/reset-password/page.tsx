"use client";

import { useEffect, useState } from "react";
import { Form, Input, Button, Alert, Spin } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Встановлення нового пароля після переходу за листом
 * (лист → /auth/callback?next=/reset-password → сесія вже в cookie).
 *
 * Після зміни пароля гасимо ВСІ ІНШІ сесії (scope: 'others') — якщо пароль
 * скидали через компрометацію, чужі сесії не переживуть зміну.
 * Той самий потік задає пароль і Google-акаунту без пароля.
 */
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = getSupabaseClient();
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
    setTimeout(() => router.push("/admin"), 1500);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "3rem" }}>🔐</div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "8px 0 4px" }}>
            Новий пароль
          </h1>
        </div>

        <div className="star-card">
          {checking ? (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <Spin />
            </div>
          ) : done ? (
            <Alert type="success" showIcon message="Пароль змінено. Переходимо в кабінет…" />
          ) : !hasSession ? (
            <Alert
              type="warning"
              showIcon
              message="Посилання недійсне або протерміноване"
              description={
                <Link href="/forgot-password">Запросити нове посилання</Link>
              }
            />
          ) : (
            <>
              {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
              )}
              <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                <Form.Item
                  name="password"
                  label={<span style={{ color: "var(--color-text-muted)" }}>Новий пароль</span>}
                  rules={[
                    { required: true, message: "Введіть новий пароль" },
                    { min: 8, message: "Мінімум 8 символів" },
                  ]}
                >
                  <Input.Password size="large" autoComplete="new-password" />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  block
                  style={{
                    background: "linear-gradient(135deg, #f5a623, #e8940f)",
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Зберегти пароль
                </Button>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
