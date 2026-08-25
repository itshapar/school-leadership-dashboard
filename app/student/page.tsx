"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import { useRouter } from "next/navigation";
import { normalizeClassCode } from "@/lib/classCodes";

/**
 * Пряма сторінка входу учня: код класу + PIN (для пам'ятки/QR без коду в URL).
 * Після входу — редирект на /class/[code]/me, де cookie вже валідна.
 */
export default function StudentLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onFinish(values: { code: string; pin: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: values.code, pin: values.pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        router.push(`/class/${normalizeClassCode(values.code)}/me`);
        return;
      }
      setError(
        body.reason === "rate_limited"
          ? "Забагато спроб. Зачекай трохи і спробуй ще раз."
          : "Невірний код класу або PIN."
      );
    } catch {
      setError("Щось пішло не так. Спробуй ще раз.");
    }
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
            Вхід для учнів
          </p>
        </div>

        <div className="star-card">
          {error && (
            <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
          )}
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="code"
              label={<span style={{ color: "var(--color-text-muted)" }}>Код класу</span>}
              rules={[{ required: true, message: "Введи код класу з пам'ятки" }]}
            >
              <Input
                size="large"
                placeholder="XXXXX-XXXXX"
                autoComplete="off"
                style={{ textTransform: "uppercase", textAlign: "center", fontWeight: 600 }}
              />
            </Form.Item>
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
                style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: "0.5em" }}
              />
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
              Увійти
            </Button>
          </Form>

          {/*
            Етап 5, п. 10: пояснення cookie простою мовою, зрозумілою дитині.
            Стоїть під кнопкою, а не в футері: рішення «це мій чи чужий
            пристрій» ухвалюється саме в момент входу.
          */}
          <p
            style={{
              marginTop: "16px",
              marginBottom: 0,
              fontSize: "0.8rem",
              lineHeight: 1.6,
              color: "var(--color-text-muted)",
            }}
          >
            Після входу на цьому пристрої збережеться cookie, щоб не вводити PIN
            щоразу. Якщо це чужий пристрій, натисни «Вийти», коли закінчиш.
          </p>
        </div>
      </div>
    </div>
  );
}
