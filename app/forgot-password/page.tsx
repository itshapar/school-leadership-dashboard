"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Запит на скидання пароля. Відповідь однакова незалежно від того,
 * чи існує email (анти-enumeration).
 */
export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish(values: { email: string }) {
    setLoading(true);
    const supabase = getSupabaseClient();
    // Помилки свідомо не показуємо деталізовано — та сама відповідь для всіх.
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
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
          <div style={{ fontSize: "3rem" }}>🔐</div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "8px 0 4px" }}>
            Скидання пароля
          </h1>
        </div>

        <div className="star-card">
          {sent ? (
            <Alert
              type="success"
              showIcon
              message="Перевірте пошту"
              description="Якщо акаунт із цим email існує, ми надіслали лист із посиланням для зміни пароля."
            />
          ) : (
            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                name="email"
                label={<span style={{ color: "var(--color-text-muted)" }}>Email</span>}
                rules={[{ required: true, type: "email", message: "Введіть email" }]}
              >
                <Input size="large" placeholder="teacher@school.ua" autoComplete="email" />
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
                Надіслати посилання
              </Button>
            </Form>
          )}
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <Link href="/admin/login">Повернутися до входу</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
