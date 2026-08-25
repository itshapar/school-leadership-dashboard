"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Input, Select, Popconfirm, message } from "antd";
import { ArrowRight } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { upsertParallelByName } from "@/lib/admin/parallels";
import {
  nextClassName,
  nextParallelName,
  type Semester,
} from "@/lib/admin/semesters";
import SemesterPicker from "@/components/Admin/SemesterPicker";
import BackButton from "@/components/BackButton";

// Той самий фіксований список 1–12, що в майстрі створення класу.
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `${n} клас` };
});

export interface RolloverStudent {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

interface Props {
  classId: string;
  classCode: string;
  className: string;
  currentSemesterId: string | null;
  currentSemesterName: string | null;
  parallelName: string | null;
  students: RolloverStudent[];
  semesters: Semester[];
}

/**
 * Майстер переходу класу в новий семестр.
 *
 * Одна сторінка, а не кроки: тут нема чого робити послідовно, все рішення
 * видно одразу, і головне в ньому, кого саме переносимо. Сам перехід робить
 * SQL-функція roll_over_class (міграція 038) однією транзакцією: або переїхало
 * все, або не сталося нічого. Клієнт лише збирає параметри.
 *
 * Що переїжджає: ПІБ, нікнейми, аватарки, групи, PIN-и й код класу, за
 * бажанням, типи балів і нагороди. Що НЕ переїжджає: бали, уроки, видані
 * призи. Заради цього все й робиться: нова програма нагород стартує з нуля.
 */
export default function RolloverClient({
  classId,
  classCode,
  className,
  currentSemesterId,
  currentSemesterName,
  parallelName,
  students,
  semesters,
}: Props) {
  const supabase = getSupabaseClient();

  // Семестр, у якому клас живе просто зараз, зі списку цілей прибираємо:
  // перенести клас сам у себе неможливо за змістом, а саме він за датами
  // зазвичай і є «поточним», тож без цього фільтра майстер підставляв його
  // першим (живий фідбек).
  const targets = useMemo(
    () => semesters.filter((s) => s.id !== currentSemesterId),
    [semesters, currentSemesterId]
  );

  // Ціль за замовчуванням: найраніший семестр, який починається ПІСЛЯ
  // поточного. Якщо такого ще немає, вчитель створює його тут же, у формі.
  const suggestedTarget = useMemo(() => {
    const current = semesters.find((s) => s.id === currentSemesterId) ?? null;
    const next = targets
      .filter((s) => !current || s.starts_on > current.starts_on)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    return next[0]?.id ?? null;
  }, [semesters, targets, currentSemesterId]);

  const [semesterList, setSemesterList] = useState(targets);
  const [semesterId, setSemesterId] = useState<string | null>(suggestedTarget);

  const [name, setName] = useState(nextClassName(className) ?? "");
  const [grade, setGrade] = useState<string | undefined>(
    (parallelName ? nextParallelName(parallelName) : null) ?? undefined
  );

  const [selected, setSelected] = useState<string[]>(students.map((s) => s.id));
  const [copyPins, setCopyPins] = useState(true);
  const [copyConfig, setCopyConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const targetSemester = semesterList.find((s) => s.id === semesterId) ?? null;
  const canSubmit = Boolean(semesterId) && name.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!semesterId) return;
    setSubmitting(true);

    // Паралель, як і в майстрі створення класу, заводиться на льоту за назвою.
    let parallelId: string | null = null;
    if (grade) {
      const res = await upsertParallelByName(supabase, grade);
      if (res.error) {
        setSubmitting(false);
        message.error(res.error);
        return;
      }
      parallelId = res.id;
    }

    const { data, error } = await supabase.rpc("roll_over_class", {
      p_source_class_id: classId,
      p_semester_id: semesterId,
      p_name: name.trim(),
      p_parallel_id: parallelId,
      p_student_ids: selected,
      p_copy_pins: copyPins,
      p_copy_config: copyConfig,
      p_move_code: true,
      p_archive_source: true,
    });

    if (error || !data) {
      setSubmitting(false);
      message.error(error?.message ?? "Не вдалося перенести клас");
      return;
    }

    const { data: created } = await supabase
      .from("classes")
      .select("public_code")
      .eq("id", data as string)
      .single();

    message.success("Клас перенесено в новий семестр");
    // Повне перезавантаження, не router.push: клієнтський Router Cache
    // інакше показує старий список класів кабінету (той самий ризик, що й
    // після видалення класу).
    window.location.href = `/admin/${created?.public_code ?? classCode}`;
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        <BackButton href={`/admin/${classCode}/settings`} label="Назад до налаштувань" />
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1.1 }}>
          Новий семестр
        </h1>
      </div>
      <p style={{ color: "#868e96", fontWeight: 600, fontSize: "0.85rem", margin: "0 0 24px" }}>
        Клас {className}
        {currentSemesterName ? ` із семестру «${currentSemesterName}»` : ""} почне наступний
        семестр з нуля. Учні, їхні нікнейми, аватарки й PIN-и переїдуть, бали,
        уроки та видані призи залишаться в архіві.
      </p>

      {/* ───────────── Семестр ───────────── */}
      <Card title="Куди переносимо" hint="Семестр, у якому клас працюватиме далі.">
        <SemesterPicker
          semesters={semesterList}
          value={semesterId}
          onChange={setSemesterId}
          onCreated={(created) => setSemesterList((prev) => [created, ...prev])}
        />
      </Card>

      {/* ───────────── Клас ───────────── */}
      <Card
        title="Клас у новому семестрі"
        hint="Назву підставлено на клас старше, змініть, якщо у вас інакше."
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Select
            style={{ width: 160 }}
            allowClear
            placeholder="Клас (1–12)"
            value={grade}
            onChange={setGrade}
            options={GRADE_OPTIONS}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="8-А"
            maxLength={60}
            style={{ width: 220 }}
          />
          <span style={{ color: "#868e96", fontWeight: 600, fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {className} <ArrowRight weight="bold" /> {name.trim() || "?"}
          </span>
        </div>
      </Card>

      {/* ───────────── Учні ───────────── */}
      <Card
        title={`Учні: ${selected.length} з ${students.length}`}
        hint="Зніміть галочку з тих, хто вже не вчиться в цьому класі."
      >
        {students.length === 0 ? (
          <div style={{ color: "#868e96", fontWeight: 600, fontSize: "0.85rem" }}>
            У класі немає учнів. Перенести можна й порожній клас, учнів додасте потім.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <Button
                className="btn-ghost"
                size="small"
                onClick={() => setSelected(students.map((s) => s.id))}
                disabled={selected.length === students.length}
              >
                Обрати всіх
              </Button>
              <Button
                className="btn-ghost"
                size="small"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
              >
                Зняти всіх
              </Button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {students.map((s) => {
                const checked = selected.includes(s.id);
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: `2px solid ${checked ? "#000" : "#dee2e6"}`,
                      background: checked ? "#fff" : "#f8f9fa",
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    <span style={{ fontSize: "1.1rem" }}>{s.avatar_emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.2 }}>
                      {s.full_name}
                      {s.nickname && (
                        <span style={{ color: "#868e96", display: "block", fontSize: "0.75rem" }}>
                          {s.nickname}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* ───────────── Що переносимо ───────────── */}
      <Card title="Що переносимо" hint="Усе, крім балів, уроків і виданих призів.">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Опис — окремим рядком під чекбоксом, а не всередині його label
              (живий фідбек): antd вирівнює квадратик по всьому вмісту label,
              тож із багаторядковим описом галочка з'їжджала на другий рядок,
              навпроти опису замість заголовка. */}
          <div>
            <Checkbox checked={copyPins} onChange={(e) => setCopyPins(e.target.checked)}>
              <span style={{ fontWeight: 600 }}>PIN-и учнів</span>
            </Checkbox>
            <div style={{ color: "#868e96", fontSize: "0.8rem", marginLeft: 24, lineHeight: 1.5 }}>
              Для дітей не змінюється нічого: той самий код класу, той самий PIN.
              Якщо зняти, PIN-и доведеться згенерувати й роздати наново.
            </div>
          </div>
          <div>
            <Checkbox checked={copyConfig} onChange={(e) => setCopyConfig(e.target.checked)}>
              <span style={{ fontWeight: 600 }}>Нагороди, типи балів і групи</span>
            </Checkbox>
            <div style={{ color: "#868e96", fontSize: "0.8rem", marginLeft: 24, lineHeight: 1.5 }}>
              Якщо зняти, новий клас отримає стандартну систему балів без нагород,
              як щойно створений.
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "#f8f9fa",
            border: "2px solid #dee2e6",
            borderRadius: 10,
            color: "#495057",
            fontWeight: 600,
            fontSize: "0.8rem",
            lineHeight: 1.5,
          }}
        >
          Клас {className} після переходу стане архівом: його можна відкрити й
          подивитися, але нараховувати бали чи видавати призи в ньому вже не
          вийде. Код класу переїде на новий клас, тож старий дашборд відкриється
          за новим кодом з його налаштувань.
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <Popconfirm
          title="Перенести клас у новий семестр?"
          description={
            targetSemester
              ? `${className} стане ${name.trim() || "?"} у семестрі «${targetSemester.name}». Учнів переїде: ${selected.length}.`
              : "Оберіть семестр"
          }
          okText="Перенести"
          cancelText="Скасувати"
          okButtonProps={{ className: "btn-primary" }}
          cancelButtonProps={{ className: "btn-secondary" }}
          onConfirm={onSubmit}
          disabled={!canSubmit}
        >
          <Button className="btn-primary" size="large" loading={submitting} disabled={!canSubmit}>
            Перенести клас
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
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
      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{title}</div>
      <div style={{ color: "#868e96", fontSize: "0.8rem", margin: "2px 0 14px" }}>{hint}</div>
      {children}
    </div>
  );
}
