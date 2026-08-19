"use client";

import { useState } from "react";
import { Form, Input, Button, Alert, Divider } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

/**
 * Реєстрація вчителя: email + пароль з підтвердженням пошти, або Google.
 * Відкрита з першого дня (PRD Р8), без інвайтів.
 *
 * Анти-enumeration: відповідь однакова і для нового email, і для вже
 * зареєстрованого — «перевірте пошту». Supabase у другому випадку сам
 * не створює дубль і не розкриває існування акаунта.
 */
export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onFinish(values: {
    display_name: string;
    email: string;
    password: string;
  }) {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        data: { display_name: values.display_name },
      },
    });
    if (error) {
      // Не деталізуємо причину (зокрема «email уже існує» сюди не потрапляє —
      // Supabase повертає це як успіх без сесії). Типові реальні причини:
      // заслабкий/витеклий пароль (Leaked password protection) або rate limit.
      setError(
        "Не вдалося зареєструватися. Перевірте пароль (мінімум 8 символів, не з відомих витоків) і спробуйте ще раз."
      );
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
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
          <div style={{ fontSize: "3rem" }}>⭐</div>
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #f5a623, #ffd700)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: "8px 0 4px",
            }}
          >
            StarBoard
          </h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Реєстрація вчителя
          </p>
        </div>

        <div className="star-card">
          {sent ? (
            <Alert
              type="success"
              showIcon
              message="Перевірте пошту"
              description="Якщо цей email ще не зареєстровано, ми надіслали лист із посиланням для підтвердження. Відкрийте його на цьому ж пристрої."
            />
          ) : (
            <>
              {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
              )}
              <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
                <Form.Item
                  name="display_name"
                  label={<span style={{ color: "var(--color-text-muted)" }}>Ваше ім&apos;я</span>}
                  rules={[
                    { required: true, message: "Введіть ім'я" },
                    { max: 100, message: "Занадто довге ім'я" },
                  ]}
                >
                  <Input size="large" placeholder="Оксана Петрівна" autoComplete="name" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label={<span style={{ color: "var(--color-text-muted)" }}>Email</span>}
                  rules={[{ required: true, type: "email", message: "Введіть email" }]}
                >
                  <Input size="large" placeholder="teacher@school.ua" autoComplete="email" />
                </Form.Item>
                <Form.Item
                  name="password"
                  label={<span style={{ color: "var(--color-text-muted)" }}>Пароль</span>}
                  rules={[
                    { required: true, message: "Введіть пароль" },
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
                    fontWeight: 700,
                  }}
                >
                  Зареєструватися
                </Button>
              </Form>
              <Divider plain style={{ margin: "16px 0" }}>
                або
              </Divider>
              <GoogleSignInButton label="Зареєструватися через Google" />
            </>
          )}

          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <Link href="/admin/login">Уже є акаунт? Увійти</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
