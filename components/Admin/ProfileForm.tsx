"use client";

import { useState } from "react";
import { Button, Input, Modal, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

/**
 * Налаштування акаунту (Етап 9.2, live-фідбек): свідомо лише видалення.
 * Ім'я й назву школи прибрали з реєстрації та профілю зовсім, щоб не
 * зв'язувати особу вчителя з конкретною школою в наших даних без потреби.
 */
export default function ProfileForm() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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
      <div
        style={{
          border: "2px solid #ffc9c9",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Небезпечна зона</div>
        <div style={{ color: "#868e96", fontSize: "0.85rem", marginTop: 4, marginBottom: 12 }}>
          Видалить акаунт, усі класи, учнів, бали й нагороди безповоротно.
        </div>
        <Button danger icon={<DeleteOutlined />} onClick={() => setOpen(true)}>
          Видалити акаунт
        </Button>
      </div>

      <Modal
        title="Видалити акаунт назавжди?"
        open={open}
        onCancel={() => setOpen(false)}
        okText="Видалити назавжди"
        okButtonProps={{ danger: true, loading: deleting, disabled: confirmText !== "ВИДАЛИТИ" }}
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
