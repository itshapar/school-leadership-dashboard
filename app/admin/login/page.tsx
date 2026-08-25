"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import AuthShell from "@/components/AuthShell";

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
    <AuthShell title="Вхід для вчителя" subtitle="Кабінет класів і журналу">
      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
      )}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="email"
          label={<span style={{ fontWeight: 600 }}>Email</span>}
          rules={[{ required: true, type: "email", message: "Введіть email" }]}
        >
          <Input size="large" placeholder="teacher@school.ua" autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label={<span style={{ fontWeight: 600 }}>Пароль</span>}
          rules={[{ required: true, message: "Введіть пароль" }]}
        >
          <Input.Password size="large" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block className="btn-primary">
          Увійти
        </Button>
      </Form>

      <GoogleSignInButton label="Увійти через Google" />

      {/* Другорядні дії — теж кнопки нашого стилю, не текстові посилання
          (живий фідбек): раніше вони виглядали як звичайні сині лінки. */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <Link href="/register" style={{ flex: 1, minWidth: 150 }}>
          <Button block className="btn-secondary">
            Зареєструватися
          </Button>
        </Link>
        <Link href="/forgot-password" style={{ flex: 1, minWidth: 150 }}>
          <Button block className="btn-secondary">
            Забули пароль?
          </Button>
        </Link>
      </div>
    </AuthShell>
  );
}
