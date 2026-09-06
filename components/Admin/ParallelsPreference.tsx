"use client";

import { useState } from "react";
import { Switch, message } from "antd";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setParallelsEnabled } from "@/lib/admin/parallels";

/**
 * Вимикач паралелей (міграція 048).
 *
 * Паралель (номер класу 1–12) — шкільна річ. Хто працює не в школі, а в студії,
 * на курсах чи в гуртку, має просто групи, і обов'язкове поле «Паралель» при
 * створенні класу для нього беззмістовне (живий фідбек). Вимкнено — поле
 * зникає з майстра класу й налаштувань, а фільтри за паралеллю з кабінету,
 * рейтингу й дашборду.
 *
 * Налаштування акаунта, а не класу: заклад один на всі класи вчителя. Наявні
 * прив'язки класів до паралелей залишаються в базі й повертаються, щойно
 * опцію ввімкнути назад.
 */
export default function ParallelsPreference({ initialEnabled }: { initialEnabled: boolean }) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function onToggle(checked: boolean) {
    setSaving(true);
    const { error } = await setParallelsEnabled(supabase, checked);
    setSaving(false);
    if (error) {
      message.error("Не вдалося змінити налаштування");
      return;
    }
    setEnabled(checked);
    message.success(checked ? "Паралелі увімкнено" : "Паралелі вимкнено");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "3px solid #000",
        boxShadow: "4px 4px 0px #000",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase" }}>
          Паралелі
        </div>
        <Switch checked={enabled} loading={saving} onChange={onToggle} />
      </div>
      <div style={{ color: "#868e96", fontSize: "0.85rem", fontWeight: 600, marginTop: 8 }}>
        Паралель, це номер класу від 1 до 12. Якщо ви працюєте не в школі, а
        там, де паралелей немає і є просто групи, вимкніть опцію: поле
        «Паралель» зникне зі створення класу й налаштувань, а фільтри за
        паралеллю, з кабінету, рейтингу та дашборду. Уже проставлені паралелі
        збережуться й повернуться, якщо ввімкнути опцію назад.
      </div>
    </div>
  );
}
