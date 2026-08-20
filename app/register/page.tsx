"use client";

import { useState } from "react";
import { Form, Input, Button, Alert, Divider, Checkbox, Progress } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { COMBINED_ACCEPT_SUBTEXT, signUpTermsMetadata } from "@/lib/legal/terms";
import { scorePassword } from "@/lib/password";

/**
 * Реєстрація вчителя: email + пароль з підтвердженням пошти, або Google.
 * Відкрита з першого дня (PRD Р8), без інвайтів.
 *
 * Анти-enumeration: відповідь однакова і для нового email, і для вже
 * зареєстрованого — «перевірте пошту». Supabase у другому випадку сам
 * не створює дубль і не розкриває існування акаунта.
 *
 * Акцепт email-реєстрації їде метаданими signUp: тригер handle_new_user
 * (міграція 025) записує його в terms_acceptances при створенні користувача.
 * У Google OAuth такого каналу немає — там акцепт фіксує TermsGate у кабінеті.
 */
export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState("");

  const strength = scorePassword(password);

  async function onFinish(values: {
    last_name: string;
    first_name: string;
    email: string;
    password: string;
  }) {
    if (!accepted) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        data: {
          display_name: `${values.last_name.trim()} ${values.first_name.trim()}`,
          ...signUpTermsMetadata(),
        },
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
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0.7 }}>
            <span style={{ fontSize: "1.3rem" }}>⭐</span>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                background: "linear-gradient(135deg, #f5a623, #ffd700)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              StarBoard
            </span>
          </div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 900,
              margin: "10px 0 0",
              textTransform: "uppercase",
              letterSpacing: "-0.5px",
            }}
          >
            Реєстрація вчителя
          </h1>
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
                <div style={{ display: "flex", gap: "12px" }}>
                  <Form.Item
                    name="last_name"
                    label={<span style={{ color: "var(--color-text-muted)" }}>Прізвище</span>}
                    style={{ flex: 1 }}
                    rules={[
                      { required: true, message: "Введіть прізвище" },
                      { max: 60, message: "Занадто довге" },
                    ]}
                  >
                    <Input size="large" placeholder="Петренко" autoComplete="family-name" />
                  </Form.Item>
                  <Form.Item
                    name="first_name"
                    label={<span style={{ color: "var(--color-text-muted)" }}>Ім&apos;я</span>}
                    style={{ flex: 1 }}
                    rules={[
                      { required: true, message: "Введіть ім'я" },
                      { max: 60, message: "Занадто довге" },
                    ]}
                  >
                    <Input size="large" placeholder="Оксана" autoComplete="given-name" />
                  </Form.Item>
                </div>
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
                    {
                      validator: (_, value: string) =>
                        !value || (/[a-zа-яіїєґ]/i.test(value) && /[0-9]/.test(value))
                          ? Promise.resolve()
                          : Promise.reject(new Error("Додайте і літери, і цифри")),
                    },
                  ]}
                >
                  <Input.Password
                    size="large"
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Form.Item>
                {password.length > 0 && (
                  <div style={{ marginTop: "-12px", marginBottom: "20px" }}>
                    <Progress
                      percent={(strength.score / 4) * 100}
                      showInfo={false}
                      strokeColor={strength.color}
                      size="small"
                    />
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: strength.color, marginTop: 2 }}>
                      {strength.label}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    padding: "14px",
                    background: "#f8f9fa",
                    border: "2px solid #dee2e6",
                    borderRadius: "10px",
                    marginBottom: "20px",
                  }}
                >
                  <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
                    <span style={{ fontSize: "0.88rem" }}>
                      Я приймаю{" "}
                      <Link href="/terms" target="_blank" style={{ fontWeight: 700 }}>
                        умови використання
                      </Link>{" "}
                      та{" "}
                      <Link href="/privacy" target="_blank" style={{ fontWeight: 700 }}>
                        політику приватності
                      </Link>
                    </span>
                  </Checkbox>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", paddingLeft: "24px" }}>
                    {COMBINED_ACCEPT_SUBTEXT}
                  </div>
                </div>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  disabled={!accepted}
                  block
                  style={{
                    background: accepted
                      ? "linear-gradient(135deg, #f5a623, #e8940f)"
                      : undefined,
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
              {/* Google-реєстрація так само вимагає акцепту. Сам акцепт
                  зафіксує TermsGate у кабінеті: OAuth-потік не передає
                  метаданих форми. */}
              <GoogleSignInButton
                label="Зареєструватися через Google"
                disabled={!accepted}
              />
              {!accepted && (
                <div
                  style={{
                    textAlign: "center",
                    marginTop: "10px",
                    fontSize: "0.8rem",
                    color: "var(--color-text-muted)",
                    fontWeight: 600,
                  }}
                >
                  Позначте пункт вище, щоб продовжити.
                </div>
              )}
            </>
          )}

          <div style={{ textAlign: "center", marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link href="/admin/login">Уже є акаунт? Увійти</Link>
            <Link href="/demo" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Спробувати демо без реєстрації →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
