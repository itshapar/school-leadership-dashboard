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
 * Підтвердження пошти вимкнене в проєкті Supabase (mailer_autoconfirm),
 * тому signUp одразу віддає сесію, і людина потрапляє у свій кабінет. Про
 * листи тут не сказано жодного слова свідомо (живий фідбек): їх немає, і
 * обіцяти людині щось у скриньці означало б посилати її чекати на те, що
 * ніколи не прийде.
 *
 * Якщо підтвердження колись увімкнуть назад, signUp поверне відповідь без
 * сесії. Тоді показуємо помилку зі спробою увійти, а не «перевірте пошту»:
 * мовчазний глухий кут гірший за чесне «щось не так».
 *
 * Акцепт email-реєстрації їде метаданими signUp: тригер handle_new_user
 * (міграція 025) записує його в terms_acceptances при створенні користувача.
 * У Google OAuth такого каналу немає — там акцепт фіксує TermsGate у кабінеті.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Окремо код помилки, бо «цей email уже зайнятий» вимагає не тексту, а
  // дій: піти на вхід або відновити пароль.
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState("");

  const strength = scorePassword(password);

  async function onFinish(values: { email: string; password: string }) {
    if (!accepted) return;

    setLoading(true);
    setError(null);
    setDuplicate(false);
    const supabase = getSupabaseClient();

    // Людина могла прийти сюди з демо, а там сесія анонімна. Її треба
    // закрити ПЕРЕД реєстрацією: інакше Supabase прив'яже email до того
    // самого користувача, і вигаданий демо-клас із вигаданими учнями
    // переїде у справжній кабінет як свій.
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser?.is_anonymous) {
      await supabase.auth.signOut();
    }
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
      // Відколи підтвердження пошти вимкнене, Supabase каже прямо:
      // user_already_exists замість мовчазного «успіху» без сесії. Раніше ми
      // ховали цей факт заради анти-enumeration, але тепер його однаково
      // видно в API, тож мовчання в інтерфейсі захищає нікого, а людину, яка
      // просто забула, що вже реєструвалася, заганяє в глухий кут.
      const code = (error as { code?: string }).code;
      if (code === "user_already_exists" || /already registered/i.test(error.message)) {
        setDuplicate(true);
        setLoading(false);
        return;
      }
      setError(
        code === "over_request_rate_limit" || code === "over_email_send_rate_limit"
          ? "Забагато спроб поспіль. Зачекайте хвилину і спробуйте ще раз."
          : "Не вдалося зареєструватися. Перевірте пароль (мінімум 8 символів, не з відомих витоків) і спробуйте ще раз."
      );
      setLoading(false);
      return;
    }
    // Сесія є завжди, поки підтвердження пошти вимкнене: одразу в кабінет.
    // Куки вже виставив createBrowserClient (@supabase/ssr), тому
    // серверний /admin побачить користувача; refresh() змушує Next
    // перезібрати серверний рендер із цими куками.
    if (data.session) {
      router.replace("/admin");
      router.refresh();
      return;
    }

    // Сесії немає: або цей email уже зареєстрований (Supabase віддає це як
    // успіх без сесії, щоб не розкривати існування акаунта), або хтось
    // увімкнув підтвердження пошти назад.
    setError(
      "Не вдалося увійти одразу. Якщо ви вже реєструвалися цією адресою, скористайтеся входом або відновленням пароля."
    );
    setLoading(false);
  }

  return (
    <AuthShell title="Реєстрація вчителя" width={440}>
      <>
          {duplicate && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: "16px" }}
              message="На цей email уже створено акаунт"
              description={
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span>Увійдіть у нього, а якщо не пам'ятаєте пароль, задайте новий.</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href="/admin/login" style={{ flex: 1, minWidth: 120 }}>
                      <Button block className="btn-primary">
                        Увійти
                      </Button>
                    </Link>
                    {/* «Новий пароль», а не «Забули пароль?»: у вузькій
                        картці сповіщення довший підпис розпирає кнопку. */}
                    <Link href="/forgot-password" style={{ flex: 1, minWidth: 120 }}>
                      <Button block className="btn-secondary">
                        Новий пароль
                      </Button>
                    </Link>
                  </div>
                </div>
              }
            />
          )}
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
