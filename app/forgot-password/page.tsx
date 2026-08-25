"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

/**
 * Запит на скидання пароля. Відповідь однакова незалежно від того,
 * чи існує email (анти-enumeration).
 */
export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish(values: { email: string }) {
    setLoading(true);
    // Помилки свідомо не показуємо деталізовано — та сама відповідь для всіх.
    const supabase = getSupabaseClient();
    await supabase.auth.resetPasswordForEmail(values.email, {
      // Ведемо ОДРАЗУ на сторінку нового пароля, а не через серверний
      // /auth/callback (живий фідбек: лист приходив, але після кліку не
      // відбувалось нічого). Частина форматів листа Supabase віддає токен
      // у хеші адреси, а хеш до сервера не долітає взагалі — тож розбирати
      // посилання має саме клієнтська сторінка.
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell title="Скидання пароля">
      {sent ? (
        <>
          <Alert
            type="success"
            showIcon
            message="Перевірте пошту"
            description="Якщо акаунт із цим email існує, ми надіслали лист із посиланням для зміни пароля. Відкрийте його на цьому ж пристрої."
            style={{ marginBottom: 16 }}
          />
          <Link href="/admin/login">
            <Button block className="btn-secondary">
              Повернутися до входу
            </Button>
          </Link>
        </>
      ) : (
        <>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 600 }}>Email</span>}
              rules={[{ required: true, type: "email", message: "Введіть email" }]}
            >
              <Input size="large" placeholder="teacher@school.ua" autoComplete="email" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block className="btn-primary">
              Надіслати посилання
            </Button>
          </Form>

          <div style={{ marginTop: 16 }}>
            <Link href="/admin/login">
              <Button block className="btn-secondary">
                Повернутися до входу
              </Button>
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
