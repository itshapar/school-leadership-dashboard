"use client";

import { useMemo, useState } from "react";
import { Button, DatePicker, Input, Popconfirm, message } from "antd";
import dayjs from "dayjs";
import { Check, Pencil, Plus, Trash, X } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createSemester,
  formatSemesterRange,
  semesterStatus,
  suggestSemesters,
  type Semester,
} from "@/lib/admin/semesters";
import BackButton from "@/components/BackButton";

const { RangePicker } = DatePicker;

const STATUS_LABEL: Record<ReturnType<typeof semesterStatus>, string> = {
  past: "Завершений",
  current: "Триває",
  future: "Попереду",
};

/**
 * Керування семестрами вчителя.
 *
 * Свідомо простий екран, як і паралелі: назва плюс період, без розкладів,
 * канікул і чвертей. Семестр тут потрібен рівно для одного, окреслити період
 * програми нагород і дати класу місце, куди перейти, коли період скінчиться.
 *
 * Перекриття періодів не забороняємо (рішення Andrew): якщо вчителю зручно
 * вести й річний, і семестровий період, це його справа. Кабінет усе одно
 * детерміновано обирає поточний, див. pickCurrentSemesterId.
 */
export default function SemesterManager({
  initialSemesters,
  classCounts,
}: {
  initialSemesters: Semester[];
  classCounts: Record<string, number>;
}) {
  const supabase = getSupabaseClient();

  const [semesters, setSemesters] = useState(initialSemesters);
  const [showForm, setShowForm] = useState(initialSemesters.length === 0);
  const [name, setName] = useState("");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRange, setEditRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    const taken = new Set(semesters.map((s) => s.name.trim().toLowerCase()));
    return suggestSemesters().filter((s) => !taken.has(s.name.toLowerCase()));
  }, [semesters]);

  async function onCreate() {
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
    setSemesters((prev) =>
      [...prev, { id, name: name.trim(), starts_on, ends_on }].sort((a, b) =>
        b.starts_on.localeCompare(a.starts_on)
      )
    );
    setName("");
    setRange(null);
    setShowForm(false);
    message.success("Семестр створено");
  }

  function startEdit(s: Semester) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditRange([dayjs(s.starts_on), dayjs(s.ends_on)]);
  }

  async function saveEdit(id: string) {
    if (!editRange || !editName.trim()) {
      message.error("Назва й період обов'язкові");
      return;
    }
    setBusy(true);
    const starts_on = editRange[0].format("YYYY-MM-DD");
    const ends_on = editRange[1].format("YYYY-MM-DD");
    const { error } = await supabase
      .from("semesters")
      .update({ name: editName.trim(), starts_on, ends_on })
      .eq("id", id);
    setBusy(false);
    if (error) {
      message.error(
        error.code === "23505" ? "Семестр із такою назвою вже є" : "Не вдалося зберегти"
      );
      return;
    }
    setSemesters((prev) =>
      prev
        .map((s) => (s.id === id ? { ...s, name: editName.trim(), starts_on, ends_on } : s))
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on))
    );
    setEditingId(null);
    message.success("Семестр збережено");
  }

  async function removeSemester(id: string) {
    setBusy(true);
    const { error } = await supabase
      .from("semesters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) {
      message.error("Не вдалося видалити семестр");
      return;
    }
    setSemesters((prev) => prev.filter((s) => s.id !== id));
    message.success("Семестр видалено");
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        <BackButton href="/admin" label="Назад до кабінету" />
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1.1 }}>
          Семестри
        </h1>
      </div>
      <p style={{ color: "#868e96", fontWeight: 600, fontSize: "0.85rem", margin: "0 0 24px" }}>
        Програма нагород розрахована на один семестр. Класи живуть усередині
        семестру, а коли він завершується, переходять у наступний з новим
        рахунком. Семестри можна створювати наперед.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button className="btn-primary" icon={<Plus />} onClick={() => setShowForm((v) => !v)}>
          Новий семестр
        </Button>
      </div>

      {showForm && (
        <div
          style={{
            background: "#fff",
            border: "3px solid #000",
            boxShadow: "4px 4px 0px #000",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: 12 }}>Новий семестр</div>

          {suggestions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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
              onClick={onCreate}
            >
              Створити
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {semesters.map((s) => {
          const status = semesterStatus(s);
          const count = classCounts[s.id] ?? 0;
          const editing = editingId === s.id;

          return (
            <div
              key={s.id}
              style={{
                background: "#fff",
                border: "3px solid #000",
                boxShadow: "4px 4px 0px #000",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {editing ? (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flex: 1 }}>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={80}
                      style={{ width: 240 }}
                    />
                    <RangePicker
                      value={editRange}
                      onChange={(v) => setEditRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                      format="DD.MM.YYYY"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      className="btn-primary"
                      icon={<Check />}
                      loading={busy}
                      onClick={() => saveEdit(s.id)}
                    />
                    <Button className="btn-secondary" icon={<X />} onClick={() => setEditingId(null)} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem" }}>{s.name}</span>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 20,
                          border: "2px solid #000",
                          background: status === "current" ? "#000" : "#fff",
                          color: status === "current" ? "#fff" : "#000",
                          fontWeight: 800,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                        }}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 4, fontWeight: 600 }}>
                      {formatSemesterRange(s)} · {count} {count === 1 ? "клас" : "класів"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Button className="btn-secondary" icon={<Pencil />} onClick={() => startEdit(s)} />
                    {count === 0 ? (
                      <Popconfirm
                        title="Видалити семестр?"
                        description="У ньому немає жодного класу, тож нічого не втратиться."
                        okText="Видалити"
                        cancelText="Скасувати"
                        okButtonProps={{ danger: true, className: "btn-danger-outline" }}
                        cancelButtonProps={{ className: "btn-secondary" }}
                        onConfirm={() => removeSemester(s.id)}
                      >
                        <Button danger className="btn-danger-outline" icon={<Trash />} loading={busy} />
                      </Popconfirm>
                    ) : (
                      <Button
                        danger
                        className="btn-danger-outline"
                        icon={<Trash />}
                        disabled
                        title="Спочатку перенесіть або видаліть класи цього семестру"
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {semesters.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 24px",
              border: "3px dashed #ced4da",
              borderRadius: 16,
              color: "#868e96",
              fontWeight: 600,
            }}
          >
            Ще немає жодного семестру.
          </div>
        )}
      </div>
    </div>
  );
}
