"use client";

import { useState } from "react";
import { Button, Modal, Select, message, Tooltip } from "antd";
import { CalendarSlash } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import dayjs from "dayjs";

interface Lesson {
  id: string;
  date: string;
}

export default function DeleteLessonButton({
  classId,
  onSuccess,
}: {
  classId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const supabase = getSupabaseClient();

  async function fetchLessons() {
    const { data } = await supabase
      .from("lessons")
      .select("id, date")
      .eq("class_id", classId)
      .order("date", { ascending: false });
    setLessons(data ?? []);
  }

  async function handleDelete() {
    if (!selectedLessonId) return;
    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedLessonId }),
      });

      if (!res.ok) {
        const json = await res.json();
        message.error(json.error ?? "Помилка видалення");
        return;
      }

      message.success("Урок видалено!");
      setOpen(false);
      setSelectedLessonId(null);
      onSuccess();
    } catch {
      message.error("Помилка мережі");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Tooltip title="ВИДАЛИТИ УРОК">
        <Button
          onClick={() => {
            setOpen(true);
            fetchLessons();
          }}
          size="middle"
          icon={<CalendarSlash />}
          style={{
            fontWeight: 800,
            borderRadius: "12px",
            background: "#ffffff",
            color: "#000",
            border: "2px solid #000",
            height: "42px",
            width: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            boxShadow: "3px 3px 0px #000"
          }}
        />
      </Tooltip>

      <Modal
        // Заголовок без іконки, капсом і жирним — як у решти поп-апів
        // (живий фідбек). Кнопки внизу теж без іконок: це commit-кнопки
        // модалки, як «Скасувати»/«Зберегти» всюди.
        title={<div style={{ fontWeight: 900, textTransform: "uppercase" }}>Видалити урок</div>}
        open={open}
        onCancel={() => setOpen(false)}
        // Без вкладеного Popconfirm (живий фідбек): сам поп-ап уже і є
        // підтвердженням, друга пара кнопок «Так, видалити»/«Ні» поверх
        // нього тільки плодила кнопки. Попередження про зірки лишилось
        // текстом у тілі поп-апу.
        footer={[
          <Button key="back" onClick={() => setOpen(false)} className="btn-secondary">
            Скасувати
          </Button>,
          <Button
            key="delete"
            danger
            disabled={!selectedLessonId}
            loading={loading}
            onClick={handleDelete}
            className="btn-danger-outline"
          >
            Видалити
          </Button>,
        ]}
      >
        <div style={{ padding: "24px 0" }}>
          <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "1rem" }}>
            Оберіть дату уроку для видалення:
          </label>
          <Select
            placeholder="Оберіть урок"
            style={{ width: "100%" }}
            size="middle"
            onChange={(val) => setSelectedLessonId(val)}
            value={selectedLessonId}
          >
            {lessons.map((l) => (
              <Select.Option key={l.id} value={l.id}>
                {dayjs(l.date).format("DD.MM.YYYY")}
              </Select.Option>
            ))}
          </Select>
          <p style={{ marginTop: "16px", color: "#666", fontSize: "0.85rem" }}>
            <span style={{ color: "#E03131", fontWeight: 600 }}>УВАГА:</span> Видалення уроку автоматично видалить усі зірки, нараховані учням за цю дату.
          </p>
        </div>
      </Modal>
    </>
  );
}
