"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, message } from "antd";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import {
  isValidPeriod,
  periodEndIso,
  periodStartIso,
  periodRangeLabel,
  type PeriodCode,
} from "@/lib/admin/periods";

const { RangePicker } = DatePicker;

/** Пн=1 ... Нд=7 (ISO), як dayjs().isoWeekday() без плагіна: рахуємо вручну. */
const WEEKDAYS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Нд" },
];

function datesInRange(start: dayjs.Dayjs, end: dayjs.Dayjs, weekdays: number[]): string[] {
  const set = new Set(weekdays);
  const out: string[] = [];
  let d = start.startOf("day");
  const last = end.startOf("day");
  while (!d.isAfter(last)) {
    if (set.has(d.day())) out.push(d.format("YYYY-MM-DD"));
    d = d.add(1, "day");
  }
  return out;
}

/**
 * Серія уроків за днями тижня й періодом — спільна форма для «Новий урок»
 * (журнал класу) і кроку 1 майстра створення класу: кількість уроків
 * задається одразу під час створення класу, а не лише пізніше з журналу.
 */
export default function LessonSeriesForm({
  classId,
  periodCode,
  onCreated,
  /**
   * У поп-апі «Новий урок» ця кнопка працює як commit-кнопка модалки, тож
   * має стояти праворуч, у тому ж ряду, де «Скасувати»/«Додати урок» у
   * режимі одного уроку (живий фідбек). У майстрі створення класу форма
   * живе просто на сторінці, там лівий край доречний.
   */
  submitAlign = "start",
}: {
  classId: string;
  /**
   * Семестр класу. Уроки живуть у межах семестру, тож календар за ці межі не
   * пускає (живий фідбек): раніше можна було завести серію уроків на дати,
   * яких у цьому семестрі не існує, і вони назавжди осідали в журналі.
   */
  periodCode: PeriodCode;
  onCreated?: (inserted: number) => void;
  submitAlign?: "start" | "end";
}) {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  const bounds = useMemo(() => {
    if (!isValidPeriod(periodCode)) return null;
    return { from: periodStartIso(periodCode), to: periodEndIso(periodCode) };
  }, [periodCode]);

  const disabledDate = (d: dayjs.Dayjs) => {
    if (!bounds) return false;
    const iso = d.format("YYYY-MM-DD");
    return iso < bounds.from || iso > bounds.to;
  };

  const seriesDates = useMemo(
    () => (range && weekdays.length > 0 ? datesInRange(range[0], range[1], weekdays) : []),
    [range, weekdays]
  );

  async function submit() {
    if (seriesDates.length === 0) {
      message.warning("Оберіть дні тижня й період");
      return;
    }
    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, dates: seriesDates }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(json.error ?? "Помилка створення уроків");
        return;
      }
      const skipped = json.skipped ?? 0;
      message.success(
        skipped > 0
          ? `Додано ${json.inserted} уроків, пропущено вже наявних: ${skipped}`
          : `Додано ${json.inserted} уроків`
      );
      onCreated?.(json.inserted ?? 0);
      setRange(null);
      setWeekdays([]);
    } catch {
      message.error("Помилка мережі");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "0.95rem" }}>
        Дні тижня:
      </label>
      <Checkbox.Group
        options={WEEKDAYS.map((w) => ({ label: w.label, value: w.value }))}
        value={weekdays}
        onChange={(v) => setWeekdays(v as number[])}
        style={{ marginBottom: 16 }}
      />

      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "0.95rem" }}>
        Період:
      </label>
      <RangePicker
        value={range}
        onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
        format="DD.MM.YYYY"
        disabledDate={disabledDate}
        style={{ width: "100%", borderRadius: "8px" }}
      />
      {bounds && (
        <div style={{ marginTop: 6, fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
          Семестр: {periodRangeLabel(periodCode)}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          flexDirection: submitAlign === "end" ? "row-reverse" : "row",
          justifyContent: submitAlign === "end" ? "flex-start" : undefined,
        }}
      >
        {/* Без іконки (живий фідбек): це та сама commit-кнопка поп-апу, що
            й «Додати урок» у режимі одного уроку. */}
        <Button
          type="primary"
          onClick={submit}
          loading={loading}
          disabled={seriesDates.length === 0}
          className="btn-primary"
        >
          {seriesDates.length > 0 ? `Додати ${seriesDates.length} уроків` : "Додати уроки"}
        </Button>
        {seriesDates.length > 0 && (
          <span style={{ color: "#868e96", fontSize: "0.82rem" }}>
            Буде створено уроків: <b>{seriesDates.length}</b>
          </span>
        )}
      </div>
    </div>
  );
}
