"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Input, Table, Tag, message } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import {
  FULL_NAME_PLACEHOLDER,
  MINIMIZATION_HINT,
  buildNamePreview,
  swapNameOrder,
} from "@/lib/students/fullName";

/**
 * Додавання учнів списком: один учень на рядок.
 *
 * Прев'ю «прізвище | ім'я» будується ЖИВЦЕМ, поки вчитель друкує — тією ж
 * функцією buildNamePreview, що й імпорт із файлу. Один розбір, одна
 * евристика, один вигляд: якщо змінити правило, воно змінюється в обох
 * шляхах одночасно.
 */
export default function StudentLinesInput({
  classId,
  onAdded,
}: {
  classId: string;
  onAdded: (count: number) => void;
}) {
  const supabase = getSupabaseClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const rawLines = useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean),
    [text]
  );
  const preview = useMemo(() => buildNamePreview(rawLines), [rawLines]);

  const invalid = preview.filter((r) => !r.valid);
  const suspicious = preview.filter((r) => r.suspicious);

  function swapSuspicious() {
    const next = rawLines.map((line, i) =>
      preview[i]?.suspicious ? swapNameOrder(line) : line
    );
    setText(next.join("\n"));
  }

  async function submit() {
    if (rawLines.length === 0) {
      message.warning("Список порожній");
      return;
    }
    if (invalid.length > 0) {
      message.error("Виправте рядки, у яких немає двох слів");
      return;
    }

    setBusy(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/student/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, names: rawLines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Не вдалося додати учнів");

      const inserted = json.inserted ?? 0;
      const skipped = json.skipped ?? 0;
      message.success(
        skipped > 0
          ? `Додано ${inserted}, пропущено вже наявних: ${skipped}`
          : `Додано ${inserted} учнів`
      );
      setText("");
      onAdded(inserted);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Помилка мережі");
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      title: "#",
      key: "n",
      width: 50,
      render: (_v: unknown, _r: unknown, i: number) => (
        <span style={{ color: "#adb5bd", fontWeight: 700 }}>{i + 1}</span>
      ),
    },
    {
      title: "Прізвище",
      dataIndex: "surname",
      key: "surname",
      render: (v: string) => <span style={{ fontWeight: 800 }}>{v || "—"}</span>,
    },
    { title: "Ім'я", dataIndex: "given", key: "given", render: (v: string) => v || "—" },
    {
      title: "",
      key: "status",
      render: (_v: unknown, row: (typeof preview)[number]) => {
        if (!row.valid) {
          return (
            <Tag color="red" style={{ margin: 0 }}>
              {row.error}
            </Tag>
          );
        }
        if (row.suspicious) {
          return (
            <Tag color="warning" style={{ margin: 0, whiteSpace: "normal" }}>
              ⚠️ {row.reason}
            </Tag>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <Input.TextArea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`${FULL_NAME_PLACEHOLDER}\nПетренко Олександр\nКовальчук Марія`}
        style={{ fontFamily: "inherit", fontSize: "0.95rem" }}
      />
      <div style={{ color: "#868e96", fontSize: "0.8rem", margin: "8px 0 16px", lineHeight: 1.55 }}>
        ⓘ Один учень на рядок, спершу прізвище.
        <br />ⓘ {MINIMIZATION_HINT}
      </div>

      {suspicious.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Схоже, у ${suspicious.length} рядках спершу йде ім'я`}
          description="Публічна сторінка показує друге слово як ім'я учня, інший порядок покаже стороннім прізвища."
          action={
            <Button size="small" icon={<SwapOutlined />} onClick={swapSuspicious}>
              Поміняти місцями
            </Button>
          }
        />
      )}

      {preview.length > 0 && (
        <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
          <Table
            dataSource={preview}
            columns={columns}
            rowKey="index"
            pagination={false}
            size="small"
          />
        </div>
      )}

      {rawLines.length > 0 && (
        <>
          <Button
            type="primary"
            loading={busy}
            disabled={invalid.length > 0}
            onClick={submit}
            style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
          >
            Додати {rawLines.length} {rawLines.length === 1 ? "учня" : "учнів"}
          </Button>
          {invalid.length > 0 && (
            <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#e03131", fontWeight: 600 }}>
              Спершу виправте рядки без прізвища та імені, кнопка неактивна, поки вони є.
            </div>
          )}
        </>
      )}
    </div>
  );
}
