"use client";

import { useMemo, useState } from "react";
import { Button, Modal, DatePicker, Space, message, Tooltip, Radio, Checkbox } from "antd";
import { CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

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

export default function NewLessonButton({
  classId,
  onSuccess,
}: {
  classId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "series">("single");
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  const seriesDates = useMemo(
    () => (range && weekdays.length > 0 ? datesInRange(range[0], range[1], weekdays) : []),
    [range, weekdays]
  );

  async function submit() {
    const body =
      mode === "single"
        ? { class_id: classId, date: date.format("YYYY-MM-DD") }
        : { class_id: classId, dates: seriesDates };

    if (mode === "series" && seriesDates.length === 0) {
      message.warning("Оберіть дні тижня й період");
      return;
    }

    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        message.warning("Урок на цю дату вже існує");
        setOpen(false);
        return;
      }
      if (!res.ok) {
        message.error(json.error ?? "Помилка створення уроку");
        return;
      }
      if (mode === "series") {
        const skipped = json.skipped ?? 0;
        message.success(
          skipped > 0
            ? `Додано ${json.inserted} уроків, пропущено вже наявних: ${skipped}`
            : `Додано ${json.inserted} уроків`
        );
      } else {
        message.success("Урок додано!");
      }
      setOpen(false);
      onSuccess();
    } catch {
      message.error("Помилка мережі");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Tooltip title="НОВИЙ УРОК">
        <Button
          onClick={() => setOpen(true)}
          size="middle"
          icon={<PlusOutlined />}
          style={{
            fontWeight: 800,
            borderRadius: "12px",
            background: "#ffffff",
            color: "var(--color-text)",
            border: "2px solid var(--color-border)",
            height: "42px",
            width: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            boxShadow: "3px 3px 0px var(--color-border)"
          }}
        />
      </Tooltip>

      <Modal
        title={
          <Space>
            <CalendarOutlined /> Додати урок
          </Space>
        }
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText={mode === "single" ? "Додати" : `Додати ${seriesDates.length || ""} уроків`.trim()}
        cancelText="Скасувати"
        okButtonProps={{ size: "large", style: { fontWeight: 700 }, loading, disabled: mode === "series" && seriesDates.length === 0 }}
        cancelButtonProps={{ size: "large" }}
      >
        <div style={{ padding: "24px 0" }}>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ marginBottom: 20 }}
          >
            <Radio.Button value="single">Один урок</Radio.Button>
            <Radio.Button value="series">Серія уроків</Radio.Button>
          </Radio.Group>

          {mode === "single" ? (
            <>
              <label style={{ display: "block", marginBottom: "12px", fontWeight: 700, fontSize: "1rem" }}>
                Оберіть дату уроку:
              </label>
              <DatePicker
                value={date}
                onChange={(d) => d && setDate(d)}
                format="DD.MM.YYYY"
                size="middle"
                style={{ width: "100%", borderRadius: "8px" }}
              />
            </>
          ) : (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "1rem" }}>
                Дні тижня:
              </label>
              <Checkbox.Group
                options={WEEKDAYS.map((w) => ({ label: w.label, value: w.value }))}
                value={weekdays}
                onChange={(v) => setWeekdays(v as number[])}
                style={{ marginBottom: 16 }}
              />

              <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "1rem" }}>
                Період:
              </label>
              <RangePicker
                value={range}
                onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
                format="DD.MM.YYYY"
                style={{ width: "100%", borderRadius: "8px" }}
              />

              {seriesDates.length > 0 && (
                <div style={{ marginTop: 12, color: "#868e96", fontSize: "0.82rem" }}>
                  Буде створено уроків: <b>{seriesDates.length}</b>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
