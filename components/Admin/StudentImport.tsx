"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Checkbox, Table, Tag, message } from "antd";
import { SwapOutlined, UploadOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import DataBasisReminder from "@/components/Admin/DataBasisReminder";
import { MINIMIZATION_HINT, swapNameOrder, type NamePreviewRow } from "@/lib/students/fullName";

/**
 * Імпорт учнів із CSV/XLSX із ОБОВ'ЯЗКОВИМ прев'ю порядку слів.
 *
 * Це не UX-люб'язність, а бар'єр Етапу 5. Публічна сторінка класу показує
 * ДРУГЕ слово поля «Прізвище та ім'я» — файл із порядком «Ім'я Прізвище» тихо
 * виставив би прізвища всіх учнів стороннім. Тому послідовність жорстка:
 *   файл → прев'ю «прізвище | ім'я» → підтвердження вчителя → запис.
 *
 * Евристика лише ПІДКАЗУЄ (позначає підозрілі рядки) — рішення завжди за
 * вчителем, і поміняти місцями можна будь-який рядок, не тільки позначений.
 */

export default function StudentImport({
  classId,
  onImported,
  disabled,
}: {
  classId: string | null;
  onImported?: (result: { studentsInserted: number; entriesInserted: number }) => void;
  disabled?: boolean;
}) {
  const supabase = getSupabaseClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<NamePreviewRow[] | null>(null);
  const [lessonColumns, setLessonColumns] = useState(0);
  const [swapped, setSwapped] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suspiciousCount = useMemo(
    () => (preview ?? []).filter((r) => r.suspicious).length,
    [preview]
  );
  const invalidCount = useMemo(
    () => (preview ?? []).filter((r) => !r.valid).length,
    [preview]
  );

  function reset() {
    setPreview(null);
    setSwapped(new Set());
    setLessonColumns(0);
    setResult(null);
    setError(null);
  }

  async function runPreview(selected: File) {
    if (!classId) {
      message.warning("Спершу оберіть клас");
      return;
    }
    setBusy(true);
    reset();
    setFile(selected);

    const formData = new FormData();
    formData.append("file", selected);
    formData.append("classId", classId);
    formData.append("mode", "preview");

    try {
      const res = await adminApiFetch(supabase, "/api/admin/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Не вдалося прочитати файл");

      setPreview(json.rows as NamePreviewRow[]);
      setLessonColumns(json.lessonColumns ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка мережі");
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!classId || !file) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("classId", classId);
    formData.append("mode", "commit");
    formData.append("swapIndices", JSON.stringify(Array.from(swapped)));

    try {
      const res = await adminApiFetch(supabase, "/api/admin/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Не вдалося імпортувати");

      setResult(json.message as string);
      setPreview(null);
      setFile(null);
      setSwapped(new Set());
      onImported?.({
        studentsInserted: json.studentsInserted ?? 0,
        entriesInserted: json.entriesInserted ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка мережі");
    } finally {
      setBusy(false);
    }
  }

  function toggleSwap(index: number) {
    setSwapped((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function swapAll(onlySuspicious: boolean) {
    const rows = (preview ?? []).filter((r) => (onlySuspicious ? r.suspicious : true));
    setSwapped((prev) => {
      const next = new Set(prev);
      const allAlready = rows.every((r) => next.has(r.index));
      rows.forEach((r) => (allAlready ? next.delete(r.index) : next.add(r.index)));
      return next;
    });
  }

  const columns = [
    {
      title: "#",
      key: "n",
      width: 50,
      render: (_v: unknown, _r: NamePreviewRow, i: number) => (
        <span style={{ color: "#adb5bd", fontWeight: 700 }}>{i + 1}</span>
      ),
    },
    {
      title: "Прізвище",
      key: "surname",
      render: (_v: unknown, row: NamePreviewRow) => {
        const isSwapped = swapped.has(row.index);
        const value = isSwapped ? row.given : row.surname;
        return <span style={{ fontWeight: 800 }}>{value || "—"}</span>;
      },
    },
    {
      title: "Ім'я",
      key: "given",
      render: (_v: unknown, row: NamePreviewRow) => {
        const isSwapped = swapped.has(row.index);
        const value = isSwapped ? row.surname : row.given;
        return <span>{value || "—"}</span>;
      },
    },
    {
      title: "Ще",
      key: "rest",
      width: 120,
      render: (_v: unknown, row: NamePreviewRow) =>
        row.rest.length > 0 ? (
          <Tag color="orange" style={{ margin: 0 }} title="Зайві слова буде збережено як є">
            {row.rest.join(" ")}
          </Tag>
        ) : (
          <span style={{ color: "#dee2e6" }}>—</span>
        ),
    },
    {
      title: "",
      key: "status",
      width: 240,
      render: (_v: unknown, row: NamePreviewRow) => {
        if (!row.valid) {
          return (
            <Tag color="red" style={{ margin: 0 }}>
              {row.error}, рядок пропустимо
            </Tag>
          );
        }
        if (row.suspicious && !swapped.has(row.index)) {
          return (
            <Tag color="warning" style={{ margin: 0, whiteSpace: "normal" }}>
              ⚠️ {row.reason}
            </Tag>
          );
        }
        if (swapped.has(row.index)) {
          return (
            <Tag color="blue" style={{ margin: 0 }}>
              поміняно місцями
            </Tag>
          );
        }
        return null;
      },
    },
    {
      title: "Поміняти",
      key: "swap",
      width: 100,
      align: "center" as const,
      render: (_v: unknown, row: NamePreviewRow) => (
        <Checkbox
          checked={swapped.has(row.index)}
          disabled={!row.valid}
          onChange={() => toggleSwap(row.index)}
        />
      ),
    },
  ];

  return (
    <div>
      <DataBasisReminder style={{ marginBottom: 16 }} />

      {result && (
        <Alert message={result} type="success" showIcon style={{ marginBottom: 16 }} />
      )}
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {!preview && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (disabled || !classId) return;
            const f = e.dataTransfer.files[0];
            if (f) void runPreview(f);
          }}
          style={{
            border: "2px dashed var(--color-border, #dee2e6)",
            borderRadius: "10px",
            padding: "32px",
            textAlign: "center",
            opacity: disabled || !classId ? 0.55 : 1,
          }}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            id="student-import-file"
            style={{ display: "none" }}
            disabled={disabled || !classId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runPreview(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="student-import-file"
            style={{ cursor: disabled || !classId ? "not-allowed" : "pointer" }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📂</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", fontWeight: 600 }}>
              {busy ? "Читаємо файл…" : "Перетягніть XLSX/CSV або клікніть"}
            </div>
          </label>
        </div>
      )}

      {preview && (
        <>
          <Alert
            type={suspiciousCount > 0 ? "warning" : "info"}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              suspiciousCount > 0
                ? `Перевірте порядок: у ${suspiciousCount} рядках спершу, схоже, йде ім'я`
                : "Перевірте розбір імен"
            }
            description={
              <span>
                Публічна сторінка класу показує <b>друге слово</b> як ім&apos;я учня.
                Якщо порядок переплутати, стороннім буде видно прізвища.
                {lessonColumns > 0 && (
                  <>
                    <br />
                    У файлі знайдено стовпців-дат: <b>{lessonColumns}</b>, з них
                    створимо уроки.
                  </>
                )}
                {invalidCount > 0 && (
                  <>
                    <br />
                    Рядків без двох слів: <b>{invalidCount}</b>, їх буде пропущено.
                  </>
                )}
                <br />ⓘ {MINIMIZATION_HINT}
              </span>
            }
          />

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {suspiciousCount > 0 && (
              <Button icon={<SwapOutlined />} onClick={() => swapAll(true)} style={{ fontWeight: 700 }}>
                Поміняти в позначених
              </Button>
            )}
            <Button icon={<SwapOutlined />} onClick={() => swapAll(false)} style={{ fontWeight: 700 }}>
              Поміняти у всіх
            </Button>
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto", marginBottom: 16 }}>
            <Table
              dataSource={preview}
              columns={columns}
              rowKey="index"
              pagination={false}
              size="small"
            />
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button
              onClick={() => {
                reset();
                setFile(null);
              }}
              disabled={busy}
            >
              Скасувати
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={busy}
              onClick={commit}
              style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
            >
              Підтверджую, імпортувати
            </Button>
          </div>
          {invalidCount > 0 && (
            <div style={{ marginTop: 8, textAlign: "right", fontSize: "0.78rem", color: "#e8590c", fontWeight: 600 }}>
              {invalidCount} рядків без прізвища та імені імпорт пропустить, решту додасть.
            </div>
          )}

          <div style={{ marginTop: 12, color: "#868e96", fontSize: "0.78rem" }}>
            Приклад результату:{" "}
            <b>
              {preview[0]
                ? swapped.has(preview[0].index)
                  ? swapNameOrder(preview[0].raw)
                  : preview[0].raw
                : "—"}
            </b>
          </div>
        </>
      )}

      <div style={{ marginTop: "16px", color: "var(--color-text-muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--color-text)" }}>Формат файлу:</strong> один стовпець,
        «Прізвище Ім&apos;я», просто списком.
      </div>
    </div>
  );
}
