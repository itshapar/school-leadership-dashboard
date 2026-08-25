"use client";

import { useEffect, useState } from "react";
import { Select, Spin } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import StudentImport from "@/components/Admin/StudentImport";
import BackButton from "@/components/BackButton";

/**
 * Сторінка імпорту учнів із файлу.
 *
 * Раніше список класів був ЗАШИТИЙ шістьма UUID-ами автора — після
 * відкриття реєстрації (Етап 4) це означало, що будь-який новий вчитель
 * бачив у селекті чужі класи (і отримував 403 при спробі). Тепер класи
 * тягнуться з БД під RLS вчителя.
 *
 * Сам імпорт із прев'ю порядку слів живе в StudentImport — той самий
 * компонент використовує майстер онбордингу.
 */
export default function ImportPage() {
  const supabase = getSupabaseClient();
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (cancelled) return;
      setClasses((data ?? []) as Array<{ id: string; name: string }>);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="page-container" style={{ maxWidth: "760px" }}>
      <div style={{ marginBottom: "8px" }}>
        <BackButton href="/admin" label="Назад до кабінету" />
      </div>

      <div className="page-header">
        <h1>📥 Імпорт учнів</h1>
        <p className="subtitle">CSV або XLSX, з перевіркою порядку «Прізвище Ім&apos;я»</p>
      </div>

      <div className="star-card">
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
            }}
          >
            Клас
          </label>
          {loading ? (
            <Spin />
          ) : (
            <Select
              placeholder="Оберіть клас..."
              value={classId ?? undefined}
              onChange={setClassId}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: "100%" }}
              size="large"
              notFoundContent="Класів ще немає"
            />
          )}
        </div>

        <StudentImport classId={classId} />
      </div>
    </div>
  );
}
