"use client";

import { useState, useEffect } from "react";
import { Form, DatePicker, Button, Alert, Select, InputNumber, message } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

const STAR_OPTIONS = [
  { value: 1, label: "⭐ 1 зірка" },
  { value: 2, label: "⭐⭐ 2 зірки" },
  { value: 3, label: "⭐⭐⭐ 3 зірки" },
];

export default function AddLessonPage() {
  const params = useParams();
  const classId = params.classId as string;
  const [students, setStudents] = useState<Student[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [starValues, setStarValues] = useState<Record<string, number>>({});
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
      if (cls) setClassName(cls.name);

      const { data } = await supabase
        .from("students")
        .select("id, full_name, nickname, avatar_emoji")
        .eq("class_id", classId)
        .order("full_name");
      if (data) {
        setStudents(data);
        // Default 2 stars for all students
        const defaults: Record<string, number> = {};
        data.forEach((s: Student) => (defaults[s.id] = 2));
        setStarValues(defaults);
      }
    }
    load();
  }, [classId]);

  async function submit() {
    setLoading(true);
    setSuccess(false);
    const supabase = getSupabaseClient();

    // Create lesson
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .insert({ class_id: classId, date: date.format("YYYY-MM-DD") })
      .select("id")
      .single();

    if (lessonErr || !lesson) {
      message.error("Помилка при створенні уроку");
      setLoading(false);
      return;
    }

    // Insert star entries for each student
    const entries = Object.entries(starValues)
      .filter(([, v]) => v > 0)
      .map(([studentId, amount]) => ({
        student_id: studentId,
        class_id: classId,
        lesson_id: lesson.id,
        type: "lesson" as const,
        amount,
      }));

    const { error: entriesErr } = await supabase.from("star_entries").insert(entries);
    if (entriesErr) {
      message.error("Помилка при збереженні зірок");
    } else {
      setSuccess(true);
      message.success(`Урок ${date.format("DD.MM.YYYY")} збережено!`);
    }
    setLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: "600px" }}>
      <div style={{ marginBottom: "8px" }}>
        <Link href="/admin" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>← Адмін</Link>
      </div>

      <div className="page-header">
        <h1>📚 {className}</h1>
        <p className="subtitle">Додати урок</p>
      </div>

      {success && (
        <Alert message="✅ Урок успішно збережено!" type="success" style={{ marginBottom: "16px" }} />
      )}

      <div className="star-card" style={{ marginBottom: "16px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            Дата уроку
          </label>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            format="DD.MM.YYYY"
            style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--color-border)" }}
          />
        </div>
      </div>

      <div className="star-card">
        <div style={{ fontWeight: 700, marginBottom: "16px" }}>🌟 Зірки за урок</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {students.map((s) => {
            const displayName = s.nickname || s.full_name.split(" ")[0];
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  background: "var(--bg-elevated)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>{s.avatar_emoji}</span>
                <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: 500 }}>{displayName}</span>
                <Select
                  value={starValues[s.id] ?? 2}
                  onChange={(v) => setStarValues((prev) => ({ ...prev, [s.id]: v }))}
                  options={[{ value: 0, label: "— не при...(по)" }, ...STAR_OPTIONS]}
                  style={{ width: "160px" }}
                  size="small"
                />
              </div>
            );
          })}
        </div>

        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={submit}
          block
          style={{
            marginTop: "20px",
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            border: "none",
            fontWeight: 700,
          }}
        >
          💾 Зберегти урок
        </Button>
      </div>
    </div>
  );
}
