"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Alert, Checkbox, Progress } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { COMBINED_ACCEPT_SUBTEXT, signUpTermsMetadata } from "@/lib/legal/terms";
import { scorePassword } from "@/lib/password";
import AuthShell from "@/components/AuthShell";

/**
 * Реєстрація вчителя: email + пароль, або Google. Відкрита з першого дня
 * (PRD Р8), без інвайтів.
 *
 * Підтвердження пошти вимкнено (живий фідбек): Supabase віддає сесію
 * одразу на signUp, і людина потрапляє у свій кабінет без походу в
 * поштову скриньку. Гілка «перевірте пошту» лишається як запасна: якщо
 * підтвердження колись увімкнуть назад у налаштуваннях проєкту, signUp
 * поверне відповідь без сесії, і реєстрація не зламається, а просто
 * знову попросить відкрити лист.
 *
 * Анти-enumeration: коли сесії немає, відповідь однакова і для нового
 * email, і для вже зареєстрованого — «перевірте пошту». Supabase у
 * другому випадку сам не створює дубль і не розкриває існування акаунта.
 *
 * Акцепт email-реєстрації їде метаданими signUp: тригер handle_new_user
 * (міграція 025) записує його в terms_acceptances при створенні користувача.
 * У Google OAuth такого каналу немає — там акцепт фіксує TermsGate у кабінеті.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState("");

  const strength = scorePassword(password);

  async function onFinish(values: { email: string; password: string }) {
    if (!accepted) return;

    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    // Ім'я й школу свідомо не питаємо (Етап 9.2, live-фідбек): менше PII —
    // менший ризик, якщо ці дані колись витечуть разом із даними учнів.
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // Куди Supabase поверне людину, якщо в дашборді ще стоїть його
        // ДЕФОЛТНИЙ шаблон листа: {{ .ConfirmationURL }} веде на verify і
        // далі сюди. Наш власний шаблон цей параметр не використовує,
        // він будує адресу сам з {{ .SiteURL }}. В обох випадках фініш
        // однаковий, сторінка входу (живий фідбек).
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/login`,
        data: signUpTermsMetadata(),
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
    // Сесія є, значить підтвердження пошти вимкнене: одразу в кабінет.
    // Куки вже виставив createBrowserClient (@supabase/ssr), тому
    // серверний /admin побачить користувача; refresh() змушує Next
    // перезібрати серверний рендер із цими куками.
    if (data.session) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell title="Реєстрація вчителя" width={440}>
      <>
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
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: strength.color, marginTop: 2 }}>
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
                      {/* Підкреслені (живий фідбек): це посилання на
                          документи, які людина приймає, і вони мають
                          читатись як посилання, а не як жирний текст. */}
                      Я приймаю{" "}
                      <Link
                        href="/terms"
                        target="_blank"
                        style={{ fontWeight: 700, color: "#000", textDecoration: "underline" }}
                      >
                        умови використання
                      </Link>{" "}
                      та{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        style={{ fontWeight: 700, color: "#000", textDecoration: "underline" }}
                      >
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
                  loading={loading}
                  disabled={!accepted}
                  block
                  className="btn-primary"
                >
                  Зареєструватися
                </Button>
              </Form>
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

          <div style={{ marginTop: "16px" }}>
            <Link href="/admin/login">
              <Button block className="btn-secondary">
                Уже є акаунт? Увійти
              </Button>
            </Link>
          </div>
      </>
    </AuthShell>
  );
}
