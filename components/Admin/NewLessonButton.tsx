"use client";

import { useState } from "react";
import { Button, Modal, DatePicker, message, Tooltip, Radio } from "antd";
import { CalendarPlus } from "@phosphor-icons/react";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import LessonSeriesForm from "@/components/Admin/LessonSeriesForm";
import {
  isValidPeriod,
  periodEndIso,
  periodRangeLabel,
  periodStartIso,
  type PeriodCode,
} from "@/lib/admin/periods";

export default function NewLessonButton({
  classId,
  periodCode,
  onSuccess,
}: {
  classId: string;
  /**
   * Семестр класу. Урок не може відбутися поза семестром, тож календар за
   * його межі не пускає (живий фідбек): раніше можна було поставити урок на
   * будь-яку дату, і в журналі з'являлась колонка з чужого семестру.
   */
  periodCode: PeriodCode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "series">("single");
  const bounds = isValidPeriod(periodCode)
    ? { from: periodStartIso(periodCode), to: periodEndIso(periodCode) }
    : null;

  /**
   * Дефолт — сьогодні, але притиснуте до меж семестру: у класі минулого
   * семестру відкривати календар на сьогоднішній, заблокованій даті означало
   * б показати вчителю порожній місяць, де все сіре.
   */
  const initialDate = () => {
    const today = dayjs();
    if (!bounds) return today;
    const iso = today.format("YYYY-MM-DD");
    if (iso < bounds.from) return dayjs(bounds.from);
    if (iso > bounds.to) return dayjs(bounds.to);
    return today;
  };

  const [date, setDate] = useState<dayjs.Dayjs>(initialDate);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  const disabledDate = (d: dayjs.Dayjs) => {
    if (!bounds) return false;
    const iso = d.format("YYYY-MM-DD");
    return iso < bounds.from || iso > bounds.to;
  };

  async function submitSingle() {
    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, date: date.format("YYYY-MM-DD") }),
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
      message.success("Урок додано!");
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
          icon={<CalendarPlus />}
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
        // Заголовок без іконки, капсом і жирним — як у решти поп-апів
        // (живий фідбек).
        title={<div style={{ fontWeight: 900, textTransform: "uppercase" }}>Новий урок</div>}
        open={open}
        onCancel={() => setOpen(false)}
        footer={
          mode === "single"
            ? [
                <Button key="cancel" onClick={() => setOpen(false)} className="btn-secondary">
                  Скасувати
                </Button>,
                <Button
                  key="ok"
                  type="primary"
                  loading={loading}
                  onClick={submitSingle}
                  className="btn-primary"
                >
                  Додати урок
                </Button>,
              ]
            : null
        }
      >
        <div style={{ padding: "24px 0" }}>
          {/* Той самий перемикач, що й «Кому призначити?» в поп-апі
              нарахування (живий фідбек): обраний варіант залитий кольором
              повністю, а не лише підсвічений обводкою. */}
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ marginBottom: 20 }}
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: "single", label: "Один урок" },
              { value: "series", label: "Серія уроків" },
            ]}
          />

          {mode === "single" ? (
            <>
              <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "1rem" }}>
                Оберіть дату уроку:
              </label>
              <DatePicker
                value={date}
                onChange={(d) => d && setDate(d)}
                format="DD.MM.YYYY"
                size="middle"
                disabledDate={disabledDate}
                style={{ width: "100%", borderRadius: "8px" }}
              />
              {bounds && (
                <div style={{ marginTop: 6, fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Семестр: {periodRangeLabel(periodCode)}
                </div>
              )}
            </>
          ) : (
            <LessonSeriesForm
              classId={classId}
              periodCode={periodCode}
              submitAlign="end"
              onCreated={() => {
                setOpen(false);
                onSuccess();
              }}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
