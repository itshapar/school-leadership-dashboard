"use client";

import { useState } from "react";
import { Button, Modal, DatePicker, Space, message, Tooltip } from "antd";
import { CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

export default function NewLessonButton({
  classId,
  onSuccess,
}: {
  classId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  async function addLesson() {
    const dateStr = date.format("YYYY-MM-DD");
    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, date: dateStr }),
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
            <CalendarOutlined /> Додати новий урок
          </Space>
        }
        open={open}
        onOk={addLesson}
        onCancel={() => setOpen(false)}
        okText="Додати"
        cancelText="Скасувати"
        okButtonProps={{ size: "large", style: { fontWeight: 700 }, loading }}
        cancelButtonProps={{ size: "large" }}
      >
        <div style={{ padding: "24px 0" }}>
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
        </div>
      </Modal>
    </>
  );
}
