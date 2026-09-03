"use client";

import { useState, useEffect, useCallback } from "react";
import { DatePicker, Button, Alert, Select, message, Spin } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import {
  entryTypeLabel,
  loadEntryTypes,
  primaryLessonType,
  type EntryType,
} from "@/lib/admin/classConfig";
import StarIcon from "@/components/StarIcon";
import BackButton from "@/components/BackButton";
import {
  isValidPeriod,
  periodEndIso,
  periodRangeLabel,
  periodStartIso,
} from "@/lib/admin/periods";

/**
 * «Швидкий урок»: створити урок і одразу проставити бали всьому класу.
 *
 * Етап 6: замість зашитого `type: 'lesson'` беремо тип класу з
 * `is_lesson_bound` (той самий, яким заповнюється журнал). Якщо вчитель завів
 * кілька таких типів — можна обрати, яким саме нараховувати.
 */

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

const STAR_OPTIONS = [
  { value: 0, label: "Не нараховувати" },
  { value: -1, label: "Н (не був)" },
  { value: 1, label: <><StarIcon /> 1 зірка</> },
  { value: 2, label: <><StarIcon /><StarIcon /> 2 зірки</> },
  { value: 3, label: <><StarIcon /><StarIcon /><StarIcon /> 3 зірки</> },
];

export default function AddLessonPage() {
  const params = useParams();
  const classParam = params.classId as string;

  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  // Семестр класу: цими межами обмежений календар, як і в поп-апі «Новий урок».
  const [periodCode, setPeriodCode] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessonTypes, setLessonTypes] = useState<EntryType[]>([]);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [starValues, setStarValues] = useState<Record<string, number>>({});
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const [success, setSuccess] = useState(false);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    // URL-параметр може бути і кодом класу, і UUID — резолвимо через RLS-запит.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const query = supabase.from("classes").select("id, name, period_code");
    const { data: cls } = UUID_RE.test(classParam)
      ? await query.eq("id", classParam).maybeSingle()
      : await query.eq("public_code", classParam.toUpperCase()).maybeSingle();

    if (!cls) {
      setInitialising(false);
      return;
    }

    setClassId(cls.id);
    setClassName(cls.name);
    setPeriodCode((cls.period_code as string | null) ?? null);

    const [{ data: studentRows }, types] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, nickname, avatar_emoji")
        .eq("class_id", cls.id)
        .is("deleted_at", null)
        .order("full_name"),
      loadEntryTypes(supabase, cls.id),
    ]);

    const lessonBound = types.filter((t) => t.is_lesson_bound);
    setLessonTypes(lessonBound);
    setTypeId(primaryLessonType(types)?.id ?? null);

    const list = (studentRows ?? []) as Student[];
    setStudents(list);
    const defaults: Record<string, number> = {};
    list.forEach((s) => (defaults[s.id] = 2));
    setStarValues(defaults);
    setInitialising(false);
  }, [classParam, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const bounds = isValidPeriod(periodCode)
    ? { from: periodStartIso(periodCode), to: periodEndIso(periodCode) }
    : null;

  const disabledDate = (d: dayjs.Dayjs) => {
    if (!bounds) return false;
    const iso = d.format("YYYY-MM-DD");
    return iso < bounds.from || iso > bounds.to;
  };

  // Дата за замовчуванням — сьогодні, але притиснута до меж семестру: у класі
  // минулого семестру календар інакше відкривався б на суцільно сірому місяці.
  useEffect(() => {
    if (!bounds) return;
    const iso = date.format("YYYY-MM-DD");
    if (iso < bounds.from) setDate(dayjs(bounds.from));
    else if (iso > bounds.to) setDate(dayjs(bounds.to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodCode]);

  async function submit() {
    if (!classId || !typeId) return;
    setLoading(true);
    setSuccess(false);

    try {
      const dateStr = date.format("YYYY-MM-DD");

      // Урок створюємо через API: там уже є перевірка власності класу
      // і коректна обробка «урок на цю дату вже існує».
      const res = await adminApiFetch(supabase, "/api/admin/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: classId, date: dateStr }),
      });

      let lessonId: string | null = null;

      if (res.status === 409) {
        // Урок уже є — дописуємо бали в нього, а не створюємо дубль.
        const { data: existing } = await supabase
          .from("lessons")
          .select("id")
          .eq("class_id", classId)
          .eq("date", dateStr)
          .maybeSingle();
        lessonId = existing?.id ?? null;
      } else {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Помилка створення уроку");
        lessonId = json.lesson?.id ?? null;
      }

      if (!lessonId) throw new Error("Не вдалося визначити урок");

      const entries = Object.entries(starValues)
        .filter(([, v]) => v !== 0)
        .map(([studentId, amount]) => ({
          student_id: studentId,
          class_id: classId,
          lesson_id: lessonId,
          entry_type_id: typeId,
          amount,
          scope: "student",
        }));

      if (entries.length === 0) {
        message.warning("Жодному учню не проставлено бали");
        setLoading(false);
        return;
      }

      // upsert: повторне збереження того самого уроку оновлює оцінки,
      // а не подвоює їх (опора — star_entries_lesson_slot_uq).
      const { error } = await supabase
        .from("star_entries")
        .upsert(entries, { onConflict: "student_id,lesson_id,entry_type_id" });

      if (error) throw new Error("Помилка при збереженні зірок");

      setSuccess(true);
      message.success(`Урок ${date.format("DD.MM.YYYY")} збережено!`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Помилка збереження");
    } finally {
      setLoading(false);
    }
  }

  if (initialising) {
    return (
      <div className="page-container" style={{ textAlign: "center", padding: "80px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: "600px" }}>
      <div style={{ marginBottom: "8px" }}>
        <BackButton href={`/admin/${classParam}`} label="Назад до журналу" />
      </div>

      <div className="page-header">
        <h1>📚 {className}</h1>
        <p className="subtitle">Додати урок і бали одразу</p>
      </div>

      {success && (
        <Alert message="✅ Урок успішно збережено!" type="success" style={{ marginBottom: "16px" }} />
      )}

      {!typeId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: "16px" }}
          message="У класі немає типу нарахування, прив'язаного до уроку"
          description={
            <span>
              Створіть його в{" "}
              <Link href={`/admin/${classParam}/settings`} style={{ fontWeight: 600 }}>
                налаштуваннях класу
              </Link>
              .
            </span>
          }
        />
      )}

      <div className="star-card" style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "8px", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
          Дата уроку
        </label>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          format="DD.MM.YYYY"
          disabledDate={disabledDate}
          style={{ width: "100%" }}
        />
        {bounds && (
          <div style={{ marginTop: 6, fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
            Семестр: {periodRangeLabel(periodCode!)}
          </div>
        )}

        {lessonTypes.length > 1 && (
          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
              Тип нарахування
            </label>
            <Select
              value={typeId}
              onChange={setTypeId}
              style={{ width: "100%" }}
              options={lessonTypes.map((t) => ({ value: t.id, label: entryTypeLabel(t) }))}
            />
          </div>
        )}
      </div>

      <div className="star-card">
        <div style={{ fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: 6 }}>
          <StarIcon /> Зірки за урок
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {students.map((s) => {
            const displayName = s.nickname || s.full_name;
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
                <span style={{ flex: 1, fontSize: "0.9rem", fontWeight: 600 }}>{displayName}</span>
                <Select
                  value={starValues[s.id] ?? 2}
                  onChange={(v) => setStarValues((prev) => ({ ...prev, [s.id]: v }))}
                  options={STAR_OPTIONS}
                  style={{ width: "180px" }}
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
          disabled={!typeId || students.length === 0}
          onClick={submit}
          block
          style={{
            marginTop: "20px",
            background: "#000",
            border: "none",
            fontWeight: 600,
          }}
        >
          💾 Зберегти урок
        </Button>
      </div>
    </div>
  );
}
