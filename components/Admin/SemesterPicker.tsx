"use client";

import { useMemo, useState } from "react";
import { Button, DatePicker, Input, Select, message } from "antd";
import dayjs from "dayjs";
import { Plus } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createSemester,
  formatSemesterRange,
  suggestSemesters,
  type Semester,
} from "@/lib/admin/semesters";

const { RangePicker } = DatePicker;

/**
 * Вибір семестру плюс створення нового тут же, без переходу на інший екран.
 *
 * Спільний для двох місць, де семестр обирають у процесі: майстер створення
 * класу й майстер переходу в новий семестр. В обох ситуація однакова, потрібного
 * семестру може ще не існувати, і виганяти людину на окрему сторінку посеред
 * майстра означає втратити все, що вона вже ввела.
 *
 * Заготовки назв (I/II семестр поточного й наступного навчального року)
 * закривають типовий випадок одним кліком; дати в них редаговані, бо в кожній
 * школі канікули свої.
 */
export default function SemesterPicker({
  semesters,
  value,
  onChange,
  onCreated,
  width = 280,
}: {
  semesters: Semester[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreated: (semester: Semester) => void;
  width?: number;
}) {
  const supabase = getSupabaseClient();

  const [open, setOpen] = useState(semesters.length === 0);
  const [name, setName] = useState("");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [creating, setCreating] = useState(false);

  const suggestions = useMemo(() => {
    const taken = new Set(semesters.map((s) => s.name.trim().toLowerCase()));
    return suggestSemesters().filter((s) => !taken.has(s.name.toLowerCase()));
  }, [semesters]);

  async function create() {
    if (!range) {
      message.error("Оберіть період семестру");
      return;
    }
    setCreating(true);
    const starts_on = range[0].format("YYYY-MM-DD");
    const ends_on = range[1].format("YYYY-MM-DD");
    const { id, error } = await createSemester(supabase, { name, starts_on, ends_on });
    setCreating(false);
    if (!id) {
      message.error(error ?? "Не вдалося створити семестр");
      return;
    }
    onCreated({ id, name: name.trim(), starts_on, ends_on });
    onChange(id);
    setName("");
    setRange(null);
    setOpen(false);
    message.success("Семестр створено");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Select
          style={{ minWidth: width, flex: 1 }}
          placeholder="Оберіть семестр"
          value={value ?? undefined}
          onChange={(v) => onChange(v ?? null)}
          options={semesters.map((s) => ({
            value: s.id,
            label: `${s.name} (${formatSemesterRange(s)})`,
          }))}
        />
        <Button className="btn-secondary" icon={<Plus />} onClick={() => setOpen((v) => !v)}>
          Новий семестр
        </Button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "2px dashed #dee2e6",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {suggestions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    setName(s.name);
                    setRange([dayjs(s.starts_on), dayjs(s.ends_on)]);
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: name === s.name ? "#000" : "#fff",
                    color: name === s.name ? "#fff" : "#000",
                    border: "2px solid #000",
                    boxShadow: "2px 2px 0px #000",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="I семестр 2026/2027"
              maxLength={80}
              style={{ width: 260 }}
            />
            <RangePicker
              value={range}
              onChange={(v) => setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              format="DD.MM.YYYY"
            />
            <Button
              className="btn-primary"
              loading={creating}
              disabled={!name.trim() || !range}
              onClick={create}
            >
              Створити
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
