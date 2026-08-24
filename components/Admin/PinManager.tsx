"use client";

import { useState } from "react";
import { Button, Modal, Popconfirm, message, Alert } from "antd";
import { KeyOutlined, CopyOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Керування PIN-ами учнів (Етап 4, переглянуто в 9.3, спрощено в 9.4).
 *
 * PIN-и шифруються оборотно (pgcrypto, міграція 033) — PIN мусить бути
 * видимий у списку учнів завжди, не лише одразу після генерації.
 * get_class_pins() читає їх у будь-який момент; ключ шифрування живе лише
 * в тілі SQL-функцій, не в клієнтському коді.
 *
 * "Друк" і "Перегенерувати" — навмисно ОКРЕМІ кнопки (9.4, живий фідбек):
 * друк лише читає наявні PIN-и через get_class_pins і нічого не змінює;
 * перегенерувати клас — деструктивна дія (reset_class_pins), що гасить усі
 * активні сесії учнів, тож завжди з попередженням.
 *
 * "Код класу" студенту вводити не треба: вчитель ділиться прямим
 * посиланням на дашборд (код у ньому вже закодований), учень бачить лише
 * поле PIN.
 */

interface StudentLite {
  id: string;
  full_name: string;
  nickname: string | null;
}

const pinStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "1.4rem",
  fontWeight: 800,
  letterSpacing: "0.15em",
};

/** Посилання, яке вчитель ділиться з учнем: код класу вже в ньому, вводити нічого не треба. */
export function studentDashboardLink(publicCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/class/${publicCode}/me`;
}

/**
 * ВАЖЛИВО: window.open мусить викликатись СИНХРОННО прямо в onClick, без
 * жодного await перед ним — інакше браузер більше не бачить це як прямий
 * результат кліку і мовчки блокує спливне вікно (без помилки в консолі,
 * просто "нічого не відбувається"). Тому відкриваємо порожнє вікно одразу
 * (openPrintWindow), а дані вже дописуємо в нього пізніше (renderPinsInto).
 */
function openPrintWindow(): Window | null {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(
      `<html><head><title>PIN-и</title></head><body style="font-family:sans-serif">Завантаження…</body></html>`
    );
  }
  return w;
}

/**
 * Друковані картки для нарізання: ім'я і PIN навмисно ЩІЛЬНО одне до
 * одного, з пунктирною рамкою — вирізав і роздав кожному учню. Посилання
 * на друку немає (9.8, живий фідбек): його вчитель ділиться окремо, через
 * Telegram-канал / Класрум / пошту, не через папірець із PIN-ом.
 */
function renderPinsInto(
  w: Window,
  className: string,
  rows: Array<{ student_id: string; pin: string }>,
  nameById: Map<string, string>
) {
  const cards = rows
    .map(
      (p) =>
        `<div style="border:1px dashed #999;padding:10px 8px;text-align:center;page-break-inside:avoid;">` +
          `<div style="font-weight:700;font-size:13px;line-height:1.2;">${nameById.get(p.student_id) ?? p.student_id}</div>` +
          `<div style="font-family:monospace;font-size:24px;font-weight:800;letter-spacing:0.2em;margin-top:2px;">${p.pin}</div>` +
        `</div>`
    )
    .join("");
  w.document.open();
  w.document.write(
    `<html><head><title>PIN-и: ${className}</title></head><body style="font-family:sans-serif">` +
      `<h2 style="margin-bottom:12px;">${className}</h2>` +
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;">${cards}</div>` +
      `</body></html>`
  );
  w.document.close();
  w.print();
}

/** Синхронний друк — коли PIN-и вже завантажені (з готового стану). */
function printPins(
  className: string,
  rows: Array<{ student_id: string; pin: string }>,
  nameById: Map<string, string>
) {
  const w = openPrintWindow();
  if (!w) {
    message.error("Браузер заблокував спливне вікно, дозвольте спливні вікна для цього сайту");
    return;
  }
  renderPinsInto(w, className, rows, nameById);
}

/** Кнопка «Скинути PIN» для одного учня. Новий PIN одразу лишається видимим у списку. */
export function ResetPinButton({
  student,
  onReset,
}: {
  student: StudentLite;
  onReset?: (pin: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  async function handleReset() {
    setLoading(true);
    const { data, error } = await supabase.rpc("reset_student_pin", {
      p_student_id: student.id,
    });
    setLoading(false);
    if (error || !data) {
      message.error("Не вдалося скинути PIN");
      return;
    }
    onReset?.(data as string);
    message.success("PIN оновлено");
  }

  return (
    <Popconfirm
      title="Скинути PIN?"
      description="Старий PIN і всі активні сесії учня перестануть діяти."
      onConfirm={handleReset}
      okText="Скинути"
      cancelText="Ні"
    >
      <Button icon={<KeyOutlined />} loading={loading} size="small" style={{ borderRadius: "8px" }} />
    </Popconfirm>
  );
}

/**
 * Друк PIN-ів усього класу — нічого не змінює, лише читає те, що вже є
 * (get_class_pins). Якщо в когось PIN-а ще немає (новий учень), про це
 * попереджаємо і пропонуємо спершу згенерувати.
 */
export function PrintClassPinsButton({
  classId,
  publicCode,
  className,
  students,
}: {
  classId: string;
  publicCode: string;
  className: string;
  students: StudentLite[];
}) {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();
  const nameById = new Map(students.map((s) => [s.id, s.full_name] as const));

  async function handleClick() {
    // Відкриваємо вікно ПЕРШИМ ділом, синхронно — див. коментар у
    // openPrintWindow. Дані підвантажуємо вже в уже відкрите вікно.
    const w = openPrintWindow();
    setLoading(true);
    const { data, error } = await supabase.rpc("get_class_pins", { p_class_id: classId });
    setLoading(false);
    if (error) {
      w?.close();
      message.error("Не вдалося завантажити PIN-и");
      return;
    }
    const rows = (data ?? []) as Array<{ student_id: string; pin: string }>;
    if (rows.length === 0) {
      w?.close();
      message.warning("У цього класу ще немає PIN-ів, спершу згенеруйте їх");
      return;
    }
    if (!w) {
      message.error("Браузер заблокував спливне вікно, дозвольте спливні вікна для цього сайту");
      return;
    }
    renderPinsInto(w, className, rows, nameById);
  }

  return (
    <Button
      icon={<PrinterOutlined />}
      loading={loading}
      onClick={handleClick}
      style={{
        fontWeight: 800,
        borderRadius: "10px",
        height: "38px",
        fontSize: "0.85rem",
      }}
    >
      РОЗДРУКУВАТИ PIN-И КЛАСУ
    </Button>
  );
}

/**
 * Масова перегенерація PIN-ів усього класу — деструктивна дія: старі PIN-и
 * й усі активні сесії учнів перестають діяти. Окрема кнопка від друку.
 */
export function RegenerateClassPinsButton({
  classId,
  publicCode,
  className,
  students,
  onReset,
}: {
  classId: string;
  publicCode: string;
  className: string;
  students: StudentLite[];
  onReset?: (pins: Record<string, string>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [pins, setPins] = useState<Array<{ student_id: string; pin: string }> | null>(null);
  const supabase = getSupabaseClient();
  const nameById = new Map(students.map((s) => [s.id, s.full_name] as const));

  async function handleReset() {
    setLoading(true);
    const { data, error } = await supabase.rpc("reset_class_pins", {
      p_class_id: classId,
    });
    setLoading(false);
    if (error || !data) {
      message.error("Не вдалося згенерувати PIN-и");
      return;
    }
    const rows = data as Array<{ student_id: string; pin: string }>;
    setPins(rows);
    onReset?.(Object.fromEntries(rows.map((r) => [r.student_id, r.pin])));
  }

  return (
    <>
      <Popconfirm
        title="Перегенерувати PIN-и всьому класу?"
        description="Старі PIN-и та всі активні сесії учнів перестануть діяти."
        onConfirm={handleReset}
        okText="Перегенерувати"
        cancelText="Ні"
      >
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          style={{
            fontWeight: 800,
            borderRadius: "10px",
            height: "38px",
            fontSize: "0.85rem",
          }}
        >
          ПЕРЕГЕНЕРУВАТИ PIN-И
        </Button>
      </Popconfirm>
      <Modal
        title={<div style={{ fontWeight: 900 }}>Нові PIN-и класу</div>}
        open={pins !== null}
        onCancel={() => setPins(null)}
        width={520}
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => pins && printPins(className, pins, nameById)}
          >
            Друк
          </Button>,
          <Button key="done" type="primary" onClick={() => setPins(null)} style={{ background: "#000" }}>
            Готово
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="PIN-и й далі видно в списку учнів будь-коли, цей екран лише для друку."
        />
        <p style={{ marginBottom: 4, wordBreak: "break-all" }}>
          Посилання: <b>{studentDashboardLink(publicCode)}</b>
        </p>
        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }}>
          {(pins ?? []).map((p) => (
            <div
              key={p.student_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <span style={{ fontWeight: 600 }}>{nameById.get(p.student_id) ?? "—"}</span>
              <span style={pinStyle}>{p.pin}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
