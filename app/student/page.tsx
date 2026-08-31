"use client";

import { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import { useRouter } from "next/navigation";
import { normalizeClassCode } from "@/lib/classCodes";
import AuthShell from "@/components/AuthShell";

/**
 * Пряма сторінка входу учня: код класу + PIN (для пам'ятки/QR без коду в URL).
 * Після входу — редирект на /class/[code]/me, де cookie вже валідна.
 *
 * Оформлення спільне з входом вчителя, через AuthShell (живий фідбек): тут
 * лишався старий стиль, золотий градієнтний напис StarBoard і помаранчева
 * кнопка-градієнт, яких більше немає ніде в продукті. Тепер логотип, шапка
 * й кнопка такі самі, як на решті екранів входу, а різницю пояснює
 * підзаголовок, не оформлення.
 *
 * Логотип веде на /student, а не на "/": корінь редіректить у кабінет
 * вчителя, і дитина, яка тицьнула зірку, опинилась би на чужому вході.
 *
 * Звертання на "ти" лишається: це учнівський екран.
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
    <AuthShell
      title="Вхід для учнів"
      subtitle="Код класу і PIN з пам'ятки"
      homeHref="/student"
    >
      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: "16px" }} />
      )}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="code"
          label={<span style={{ fontWeight: 600 }}>Код класу</span>}
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
          label={<span style={{ fontWeight: 600 }}>PIN (6 цифр)</span>}
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
              fontSize: "1.3rem",
              letterSpacing: "0.5em",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block className="btn-primary">
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
          fontWeight: 600,
          lineHeight: 1.6,
          color: "var(--color-text-muted)",
        }}
      >
        Після входу на цьому пристрої збережеться cookie, щоб не вводити PIN
        щоразу. Якщо це чужий пристрій, натисни «Вийти», коли закінчиш.
      </p>
    </AuthShell>
  );
}
