"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Modal, message } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  COMBINED_ACCEPT_SUBTEXT,
  TERMS_VERSION,
  recordTermsAcceptance,
} from "@/lib/legal/terms";

/**
 * Блокуючий акцепт Умов у кабінеті.
 *
 * Потрібен для двох випадків, які форма реєстрації не покриває:
 *   • вхід через Google — метаданих форми в signUp немає, тому тригер
 *     handle_new_user не має що записати;
 *   • акаунти, створені ДО появи чекбоксів (зокрема акаунт автора), і будь-яке
 *     підняття TERMS_VERSION — тобто нова редакція Умов.
 *
 * Це єдине місце у продукті, де блокуюча модалка виправдана: без правової
 * підстави вчитель не повинен вносити дані учнів, а «нагадування збоку» тут
 * рівносильне його відсутності. Модалка не закривається ані Esc, ані кліком
 * поза нею — інакше вона перетворилась би на банер, який гортають.
 */
export default function TermsGate() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = accepted;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const { error } = await recordTermsAcceptance(supabase, "guard");
    setSaving(false);

    if (error) {
      message.error("Не вдалося зберегти підтвердження. Спробуйте ще раз.");
      return;
    }
    message.success("Дякуємо");
    router.refresh();
  }

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      keyboard={false}
      centered
      width={560}
      title={
        <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
          Підтвердьте Умови
        </div>
      }
      footer={[
        <Button
          key="ok"
          type="primary"
          size="large"
          disabled={!canSubmit}
          loading={saving}
          onClick={submit}
          style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
        >
          ПІДТВЕРДИТИ
        </Button>,
      ]}
    >
      {/*
        Формулювання нейтральне навмисно: цю модалку бачать і ті, хто приймає
        Умови ВПЕРШЕ (вхід через Google), і ті, кому показали нову редакцію.
        «Ми оновили документи» для першого випадку було б неправдою.
      */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message={`Редакція ${TERMS_VERSION}`}
        description="Перш ніж працювати з даними учнів, підтвердьте пункт нижче."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/*
          Підкреслені й чорні (живий фідбек): вчитель цілився в рядок, щоб
          поставити галочку, влучав у назву документа і не розумів, чому
          відкрилась нова вкладка. Тепер видно, що це посилання, а не текст.

          stopPropagation: клік по посиланню більше не перемикає заразом і
          чекбокс, інакше «я лише хотів почитати» тихо ставило згоду.
        */}
        <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
          Я приймаю{" "}
          <Link
            href="/terms"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            style={{ fontWeight: 700, color: "#000", textDecoration: "underline" }}
          >
            умови використання
          </Link>{" "}
          та{" "}
          <Link
            href="/privacy"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            style={{ fontWeight: 700, color: "#000", textDecoration: "underline" }}
          >
            політику приватності
          </Link>
        </Checkbox>
        <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", paddingLeft: "24px" }}>
          {COMBINED_ACCEPT_SUBTEXT}
        </div>
      </div>
    </Modal>
  );
}
