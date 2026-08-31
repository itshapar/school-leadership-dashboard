"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import { useRouter } from "next/navigation";

/**
 * Форма входу учня. Код класу вже відомий (з URL сторінки /class/[code]/me),
 * учень вводить лише свій PIN. Після успіху cookie вже стоїть —
 * router.refresh() перерендерює сторінку, і сервер покаже дашборд.
 */
export default function StudentPinLogin({
  code,
  className,
}: {
  code: string;
  className: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onFinish(values: { pin: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin: values.pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        router.refresh();
        return;
      }
      setError(
        body.reason === "rate_limited"
          ? "Забагато спроб. Зачекай трохи і спробуй ще раз."
          : "Невірний PIN. Якщо забув, попроси вчителя скинути."
      );
    } catch {
      setError("Щось пішло не так. Спробуй ще раз.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "3rem" }}>🔑</div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "8px 0 4px" }}>
            Вхід учня
          </h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            {className} · введи свій PIN один раз, далі вхід буде автоматичним
          </p>
        </div>

        <div className="star-card">
          {error && (
            <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
          )}
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="pin"
              label={<span style={{ color: "var(--color-text-muted)" }}>PIN (6 цифр)</span>}
              rules={[
                { required: true, message: "Введи PIN" },
                { pattern: /^\d{6}$/, message: "PIN складається з 6 цифр" },
              ]}
            >
              <Input
                size="large"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="••••••"
                style={{
                  textAlign: "center",
                  fontSize: "1.5rem",
                  letterSpacing: "0.5em",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            </Form.Item>
            {/* Той самий вигляд, що й на /student і на вході вчителя
                (живий фідбек): помаранчевий градієнт лишався тільки тут
                і на сторінці входу учня. */}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="btn-primary"
            >
              Увійти
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
