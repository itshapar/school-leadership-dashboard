"use client";

import { useState } from "react";
import { Upload, Button, Select, Alert, Progress, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

const CLASS_OPTIONS = [
  { value: "11111111-0000-0000-0000-000000000001", label: "7А" },
  { value: "11111111-0000-0000-0000-000000000002", label: "7Б" },
  { value: "11111111-0000-0000-0000-000000000003", label: "7В" },
  { value: "11111111-0000-0000-0000-000000000004", label: "7Г" },
  { value: "11111111-0000-0000-0000-000000000005", label: "7Д" },
  { value: "11111111-0000-0000-0000-000000000006", label: "7Е" },
];

export default function ImportPage() {
  const supabase = getSupabaseClient();
  const [classId, setClassId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  async function handleImport() {
    if (!file || !classId) {
      message.warning("Оберіть клас та файл");
      return;
    }
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("classId", classId);

    try {
      const res = await adminApiFetch(supabase, "/api/admin/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setResult({ success: json.message });
      } else {
        setResult({ error: json.error ?? "Невідома помилка" });
      }
    } catch {
      setResult({ error: "Помилка мережі" });
    }
    setLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: "500px" }}>
      <div style={{ marginBottom: "8px" }}>
        <Link href="/admin" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>← Адмін</Link>
      </div>

      <div className="page-header">
        <h1>📥 Імпорт XLSX</h1>
        <p className="subtitle">Одноразовий імпорт даних класу</p>
      </div>

      {result?.success && <Alert message={result.success} type="success" style={{ marginBottom: "16px" }} />}
      {result?.error && <Alert message={result.error} type="error" style={{ marginBottom: "16px" }} />}

      <div className="star-card">
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            Клас
          </label>
          <Select
            placeholder="Оберіть клас..."
            value={classId || undefined}
            onChange={setClassId}
            options={CLASS_OPTIONS}
            style={{ width: "100%" }}
            size="large"
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            XLSX файл
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            style={{
              border: "2px dashed var(--color-border)",
              borderRadius: "10px",
              padding: "32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              id="xlsx-file"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            <label htmlFor="xlsx-file" style={{ cursor: "pointer" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📂</div>
              <div style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                {file ? (
                  <span style={{ color: "var(--color-primary)" }}>✅ {file.name}</span>
                ) : (
                  "Перетягніть файл або клікніть"
                )}
              </div>
            </label>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={handleImport}
          block
          style={{
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            border: "none",
            fontWeight: 700,
          }}
        >
          🚀 Імпортувати
        </Button>

        <div style={{ marginTop: "16px", color: "var(--color-text-muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--color-text)" }}>Формат файлу:</strong><br/>
          col 0: ПІБ · col 2: emoji · col 3: нікнейм · col 4: бонус або Кіндер<br/>
          Далі — стовпці призів (True/False), потім дати (⭐, ⭐⭐, ⭐⭐⭐)
        </div>
      </div>
    </div>
  );
}
