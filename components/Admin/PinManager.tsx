"use client";

import { useState } from "react";
import { Button, Modal, Popconfirm, message, Alert } from "antd";
import { KeyOutlined, CopyOutlined, PrinterOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatClassCode } from "@/lib/classCodes";

/**
 * Керування PIN-ами учнів (Етап 4).
 *
 * PIN-и зберігаються лише bcrypt-хешами, тому показати наявний PIN
 * неможливо — тільки згенерувати новий. Обидві RPC — SECURITY INVOKER:
 * RLS гарантує, що вчитель скидає PIN-и лише своїм учням.
 * Скидання інвалідовує всі активні сесії учня (pin_generation++).
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

/** Кнопка «Скинути PIN» для одного учня. Новий PIN показується один раз. */
export function ResetPinButton({ student }: { student: StudentLite }) {
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  async function onReset() {
    setLoading(true);
    const { data, error } = await supabase.rpc("reset_student_pin", {
      p_student_id: student.id,
    });
    setLoading(false);
    if (error || !data) {
      message.error("Не вдалося скинути PIN");
      return;
    }
    setPin(data as string);
  }

  return (
    <>
      <Popconfirm
        title="Скинути PIN?"
        description="Старий PIN і всі активні сесії учня перестануть діяти."
        onConfirm={onReset}
        okText="Скинути"
        cancelText="Ні"
      >
        <Button icon={<KeyOutlined />} loading={loading} style={{ borderRadius: "8px" }} />
      </Popconfirm>
      <Modal
        title={<div style={{ fontWeight: 900 }}>Новий PIN</div>}
        open={pin !== null}
        onOk={() => setPin(null)}
        onCancel={() => setPin(null)}
        cancelButtonProps={{ style: { display: "none" } }}
        okText="Готово"
      >
        <p style={{ marginBottom: 8 }}>{student.full_name}:</p>
        <div style={{ ...pinStyle, fontSize: "2rem", textAlign: "center", margin: "12px 0" }}>
          {pin}
        </div>
        <Alert
          type="warning"
          showIcon
          message="PIN показується лише один раз — запишіть або передайте учню зараз."
        />
      </Modal>
    </>
  );
}

/**
 * Масова генерація PIN-ів усього класу + пам'ятка «код класу + PIN-и»
 * для роздачі учням (копіювання/друк). PIN-и видно лише один раз.
 */
export function ResetClassPinsButton({
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
  const [pins, setPins] = useState<Array<{ student_id: string; pin: string }> | null>(null);
  const supabase = getSupabaseClient();

  const nameById = new Map(students.map((s) => [s.id, s.full_name] as const));

  async function onReset() {
    setLoading(true);
    const { data, error } = await supabase.rpc("reset_class_pins", {
      p_class_id: classId,
    });
    setLoading(false);
    if (error || !data) {
      message.error("Не вдалося згенерувати PIN-и");
      return;
    }
    setPins(data as Array<{ student_id: string; pin: string }>);
  }

  function memoText(): string {
    const lines = [
      `Клас ${className} — вхід на свій дашборд`,
      `Сторінка: /student · Код класу: ${formatClassCode(publicCode)}`,
      "",
      ...(pins ?? []).map(
        (p) => `${nameById.get(p.student_id) ?? p.student_id} — PIN ${p.pin}`
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

  function onPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<pre style="font-family:monospace;font-size:14px;line-height:1.7">${memoText()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`
    );
    w.document.close();
    w.print();
  }

  return (
    <>
      <Popconfirm
        title="Згенерувати PIN-и всьому класу?"
        description="Старі PIN-и та всі активні сесії учнів перестануть діяти."
        onConfirm={onReset}
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
          PIN-И КЛАСУ
        </Button>
      </Popconfirm>
      <Modal
        title={<div style={{ fontWeight: 900 }}>Пам&apos;ятка: код класу + PIN-и</div>}
        open={pins !== null}
        onCancel={() => setPins(null)}
        width={520}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={onCopy}>
            Копіювати
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
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="PIN-и показуються лише один раз. Скопіюйте або роздрукуйте пам'ятку зараз."
        />
        <p style={{ marginBottom: 4 }}>
          Вхід: сторінка <b>/student</b> · Код класу: <b>{formatClassCode(publicCode)}</b>
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
