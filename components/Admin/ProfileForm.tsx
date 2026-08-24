"use client";

import { useState } from "react";
import { Button, Form, Input, Modal, message } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

/**
 * Профіль вчителя: зміна email, зміна пароля, видалення акаунту. Ім'я й
 * назву школи прибрали з реєстрації та профілю зовсім, щоб не зв'язувати
 * особу вчителя з конкретною школою в наших даних без потреби.
 *
 * Обидві форми йдуть через supabase.auth.updateUser — сесія вже є,
 * повторного пароля не питаємо. Зміна email надсилає лист-підтвердження на
 * нову адресу (стандартна поведінка Supabase); стара сесія лишається чинною
 * до підтвердження.
 */

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "3px solid #000",
  boxShadow: "4px 4px 0px #000",
  borderRadius: 12,
  padding: "16px 20px",
  marginBottom: 16,
};

export default function ProfileForm({ currentEmail }: { currentEmail: string }) {
  const supabase = getSupabaseClient();

  const [emailForm] = Form.useForm<{ email: string }>();
  const [passwordForm] = Form.useForm<{ password: string; confirm: string }>();
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function onEmailFinish(values: { email: string }) {
    if (values.email.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
      message.info("Це вже поточний email");
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: values.email.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/profile` }
    );
    setSavingEmail(false);
    if (error) {
      message.error(error.message || "Не вдалося змінити email");
      return;
    }
    message.success("Лист-підтвердження надіслано на нову адресу");
  }

  async function onPasswordFinish(values: { password: string }) {
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSavingPassword(false);
    if (error) {
      message.error(
        error.message.includes("Password")
          ? "Пароль надто слабкий або вже засвітився у витоках"
          : "Не вдалося змінити пароль"
      );
      return;
    }
    passwordForm.resetFields();
    message.success("Пароль оновлено");
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/account", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Не вдалося видалити акаунт");
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Не вдалося видалити акаунт");
      setDeleting(false);
    }
  }

  return (
    <>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: 12, textTransform: "uppercase" }}>
          Email
        </div>
        <Form
          form={emailForm}
          layout="inline"
          onFinish={onEmailFinish}
          initialValues={{ email: currentEmail }}
          style={{ flexWrap: "wrap", gap: 8 }}
        >
          <Form.Item
            name="email"
            rules={[{ required: true, type: "email", message: "Введіть коректний email" }]}
            style={{ flex: 1, minWidth: 220, marginRight: 0 }}
          >
            <Input size="large" autoComplete="email" />
          </Form.Item>
          <Button htmlType="submit" loading={savingEmail} className="btn-secondary">
            Змінити email
          </Button>
        </Form>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: 12, textTransform: "uppercase" }}>
          Пароль
        </div>
        <Form form={passwordForm} layout="vertical" onFinish={onPasswordFinish}>
          <Form.Item
            name="password"
            label={<span>Новий пароль</span>}
            rules={[
              { required: true, message: "Введіть новий пароль" },
              { min: 8, message: "Мінімум 8 символів" },
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={<span>Повторіть пароль</span>}
            dependencies={["password"]}
            rules={[
              { required: true, message: "Повторіть новий пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Паролі не збігаються"));
                },
              }),
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Button htmlType="submit" loading={savingPassword} className="btn-secondary">
            Змінити пароль
          </Button>
        </Form>
      </div>

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px #e03131",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Небезпечна зона</div>
        <div style={{ color: "#868e96", fontSize: "0.85rem", marginTop: 4, marginBottom: 12 }}>
          Видалить акаунт, усі класи, учнів, бали й нагороди безповоротно.
        </div>
        <Button danger onClick={() => setOpen(true)} className="btn-danger-outline">
          Видалити акаунт
        </Button>
      </div>

      <Modal
        title="Видалити акаунт назавжди?"
        open={open}
        onCancel={() => setOpen(false)}
        okText="Видалити назавжди"
        okButtonProps={{
          danger: true,
          loading: deleting,
          disabled: confirmText !== "ВИДАЛИТИ",
          className: "btn-danger-outline",
        }}
        cancelButtonProps={{ className: "btn-secondary" }}
        cancelText="Скасувати"
        onOk={deleteAccount}
      >
        <p>
          Усі ваші класи, учні, бали й нагороди буде видалено безповоротно.
          Це неможливо скасувати.
        </p>
        <p>
          Введіть <b>ВИДАЛИТИ</b>, щоб підтвердити:
        </p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
