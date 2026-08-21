"use client";

import { useState } from "react";
import { Button, Modal, Popconfirm, message, Alert } from "antd";
import { KeyOutlined, CopyOutlined, PrinterOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Керування PIN-ами учнів (Етап 4, переглянуто в 9.3).
 *
 * PIN-и шифруються оборотно (pgcrypto, міграція 033) — на прохання вчителя
 * PIN мусить бути видимий у списку учнів завжди, не лише одразу після
 * генерації. get_class_pins() читає їх у будь-який момент; ключ шифрування
 * живе лише в тілі SQL-функцій, не в клієнтському коді.
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
 * Масова генерація PIN-ів усього класу + друковна пам'ятка "ім'я + PIN"
 * для роздачі учням (вирізати й видати кожному листочок).
 */
export function ResetClassPinsButton({
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

  function memoText(): string {
    const link = studentDashboardLink(publicCode);
    const lines = [
      `Клас ${className}, вхід на дашборд`,
      `Посилання: ${link}`,
      "",
      ...(pins ?? []).map(
        (p) => `${nameById.get(p.student_id) ?? p.student_id}: PIN ${p.pin}`
      ),
    ];
    return lines.join("\n");
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(memoText());
      message.success("Пам'ятку скопійовано");
    } catch {
      message.error("Не вдалося скопіювати");
    }
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(studentDashboardLink(publicCode));
      message.success("Посилання скопійовано");
    } catch {
      message.error("Не вдалося скопіювати");
    }
  }

  function onPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = (pins ?? [])
      .map(
        (p) =>
          `<tr><td>${nameById.get(p.student_id) ?? p.student_id}</td><td style="font-family:monospace;font-size:20px;font-weight:800;letter-spacing:0.15em">${p.pin}</td></tr>`
      )
      .join("");
    w.document.write(
      `<html><head><title>PIN-и: ${className}</title></head><body style="font-family:sans-serif">` +
        `<h2>${className}</h2>` +
        `<p>Посилання: ${studentDashboardLink(publicCode)}</p>` +
        `<table style="border-collapse:collapse;width:100%" border="1" cellpadding="8">${rows}</table>` +
        `</body></html>`
    );
    w.document.close();
    w.print();
  }

  return (
    <>
      <Popconfirm
        title="Згенерувати нові PIN-и всьому класу?"
        description="Старі PIN-и та всі активні сесії учнів перестануть діяти."
        onConfirm={handleReset}
        okText="Згенерувати"
        cancelText="Ні"
      >
        <Button
          icon={<KeyOutlined />}
          loading={loading}
          style={{
            fontWeight: 800,
            borderRadius: "10px",
            height: "38px",
            fontSize: "0.85rem",
          }}
        >
          РОЗДРУКУВАТИ PIN-И КЛАСУ
        </Button>
      </Popconfirm>
      <Modal
        title={<div style={{ fontWeight: 900 }}>PIN-и класу</div>}
        open={pins !== null}
        onCancel={() => setPins(null)}
        width={520}
        footer={[
          <Button key="link" icon={<CopyOutlined />} onClick={onCopyLink}>
            Копіювати посилання
          </Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={onCopy}>
            Копіювати список
          </Button>,
          <Button key="print" icon={<PrinterOutlined />} onClick={onPrint}>
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
          message="PIN-и й далі видно в списку учнів будь-коли — цей екран лише для друку."
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
