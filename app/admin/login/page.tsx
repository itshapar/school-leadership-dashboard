"use client";

import { useState } from "react";
import { Form, Input, Button, Alert, Card, Divider } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setError("Невірний email або пароль.");
      setLoading(false);
    } else {
      // ПОВНЕ перезавантаження, НЕ router.push: клієнтський Router Cache
      // Next.js тримає RSC-пейлоад /admin попереднього користувача до 30с
      // і router.push міг би показати старі дані ПОПЕРЕДНЬОГО акаунта —
      // критична витік між акаунтами, знайдений при тестуванні Етапу 9.
      window.location.href = "/admin";
    }
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
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Адмін панель</p>
        </div>

        <div className="star-card">
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: "16px", background: "rgba(255,77,79,0.1)", border: "1px solid rgba(255,77,79,0.3)" }}
            />
          )}
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
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
              rules={[{ required: true, message: "Введіть пароль" }]}
            >
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)", border: "none", fontWeight: 700 }}
            >
              Увійти
            </Button>
          </Form>

          <Divider plain style={{ margin: "16px 0" }}>
            або
          </Divider>
          <GoogleSignInButton label="Увійти через Google" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "16px",
            }}
          >
            <Link href="/register">Зареєструватися</Link>
            <Link href="/forgot-password">Забули пароль?</Link>
          </div>
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <Link href="/demo" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Спробувати демо без реєстрації →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
