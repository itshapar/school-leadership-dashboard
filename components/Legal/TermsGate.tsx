"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Modal, message } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DATA_BASIS_ACCEPT_LABEL,
  TERMS_ACCEPT_LABEL,
  TERMS_VERSION,
  recordTermsAcceptance,
} from "@/lib/legal/terms";

/**
 * Блокуючий акцепт Умов у кабінеті.
 *
 * Потрібен для двох випадків, які форма реєстрації не покриває:
 *   • вхід через Google — метаданих форми в signUp немає, тому тригер
 *     handle_new_user не має що записати;
 *   • акаунти, створені ДО появи чекбоксів (зокрема акаунт автора), і будь-яка
 *     НОВА версія Умов після рев'ю юриста.
 *
 * Це єдине місце у продукті, де блокуюча модалка виправдана: без правової
 * підстави вчитель не повинен вносити дані учнів, а «нагадування збоку» тут
 * рівносильне його відсутності. Модалка не закривається ані Esc, ані кліком
 * поза нею — інакше вона перетворилась би на банер, який гортають.
 */
export default function TermsGate() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDataBasis, setAcceptedDataBasis] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = acceptedTerms && acceptedDataBasis;

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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message={`Редакція ${TERMS_VERSION}`}
        description="Ми оновили документи. Щоб продовжити роботу з класами, підтвердьте обидва пункти."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Checkbox
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
        >
          {TERMS_ACCEPT_LABEL} (
          <Link href="/terms" target="_blank" style={{ fontWeight: 700 }}>
            Умови
          </Link>
          ,{" "}
          <Link href="/privacy" target="_blank" style={{ fontWeight: 700 }}>
            Приватність
          </Link>
          )
        </Checkbox>

        <Checkbox
          checked={acceptedDataBasis}
          onChange={(e) => setAcceptedDataBasis(e.target.checked)}
        >
          {DATA_BASIS_ACCEPT_LABEL}
        </Checkbox>
      </div>
    </Modal>
  );
}
