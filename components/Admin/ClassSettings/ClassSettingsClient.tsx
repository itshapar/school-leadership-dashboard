"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Popconfirm, Select, Spin, Switch, Tabs, message } from "antd";
import Link from "next/link";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  loadClassPrizes,
  loadIndividualPrizes,
  type ClassPrize,
  type IndividualPrize,
} from "@/lib/admin/classConfig";
import PrizesPanel from "@/components/Admin/ClassSettings/PrizesPanel";
import { PrintClassPinsButton, RegenerateClassPinsButton } from "@/components/Admin/PinManager";
import { setClassParallel, upsertParallelByName, type Parallel } from "@/lib/admin/parallels";

// Той самий фіксований список 1–12, що й у майстрі створення класу.
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `${n} клас` };
});

/**
 * Налаштування класу — одне місце замість модалки «Нагороди».
 *
 * Система балів (типи нарахувань) тут більше НЕ редагується — Етап 9 зробив
 * її фіксованим стандартом для всіх класів (накочується автоматично при
 * створенні, див. OnboardingWizard.createClass). Замість вкладки "Типи
 * нарахувань" тут тепер код класу і PIN-и — раніше вони жили в кроці
 * майстра "Коди", який прибрали: показувати їх варто вже ПІСЛЯ створення
 * класу, а не як обов'язковий крок.
 */

export interface StudentRow {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

interface Props {
  classId: string;
  classCode: string;
  className: string;
  initialArchived: boolean;
  initialShowClassmateStars: boolean;
  initialParallelId: string | null;
  parallels: Parallel[];
  initialStudents: StudentRow[];
}

export default function ClassSettingsClient({
  classId,
  classCode,
  className,
  initialArchived,
  initialShowClassmateStars,
  initialParallelId,
  parallels,
  initialStudents,
}: Props) {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState(initialArchived);
  const [showClassmateStars, setShowClassmateStars] = useState(initialShowClassmateStars);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [parallelId, setParallelId] = useState(initialParallelId);
  const [savingParallel, setSavingParallel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [individualPrizes, setIndividualPrizes] = useState<IndividualPrize[]>([]);
  const [classPrizes, setClassPrizes] = useState<ClassPrize[]>([]);
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);

  const refresh = useCallback(async () => {
    try {
      const [indiv, cls, studentsRes] = await Promise.all([
        loadIndividualPrizes(supabase, classId),
        loadClassPrizes(supabase, classId),
        supabase
          .from("students")
          .select("id, full_name, nickname, avatar_emoji, group_id")
          .eq("class_id", classId)
          .is("deleted_at", null)
          .order("full_name"),
      ]);
      setIndividualPrizes(indiv);
      setClassPrizes(cls);
      setStudents((studentsRes.data ?? []) as StudentRow[]);
    } catch {
      message.error("Не вдалося завантажити налаштування");
    } finally {
      setLoading(false);
    }
  }, [classId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggleArchive() {
    setBusy(true);
    const { error } = await supabase
      .from("classes")
      .update({ archived_at: archived ? null : new Date().toISOString() })
      .eq("id", classId);
    setBusy(false);
    if (error) {
      message.error("Не вдалося змінити статус архіву");
      return;
    }
    setArchived((v) => !v);
    message.success(archived ? "Клас повернуто з архіву" : "Клас заархівовано");
    router.refresh();
  }

  async function onGradeChange(grade: string | undefined) {
    setSavingParallel(true);
    let nextId: string | null = null;
    if (grade) {
      const { id, error } = await upsertParallelByName(supabase, grade);
      if (error || !id) {
        setSavingParallel(false);
        message.error("Не вдалося змінити паралель");
        return;
      }
      nextId = id;
    }
    const { error } = await setClassParallel(supabase, classId, nextId);
    setSavingParallel(false);
    if (error) {
      message.error("Не вдалося змінити паралель");
      return;
    }
    setParallelId(nextId);
    router.refresh();
  }

  async function toggleClassmateStars(checked: boolean) {
    setSavingVisibility(true);
    const { error } = await supabase
      .from("classes")
      .update({ show_classmate_stars: checked })
      .eq("id", classId);
    setSavingVisibility(false);
    if (error) {
      message.error("Не вдалося змінити налаштування");
      return;
    }
    setShowClassmateStars(checked);
  }

  async function deleteClassForever() {
    setBusy(true);
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    setBusy(false);
    if (error) {
      message.error("Не вдалося видалити клас");
      return;
    }
    message.success("Клас видалено");
    // Повне перезавантаження, не router.push (живий фідбек) — клієнтський
    // Router Cache інакше й далі показує видалений клас у списку /admin,
    // доки хтось не оновить сторінку вручну. Той самий ризик, що й у
    // AdminLogoutButton/StudentLogoutButton.
    window.location.href = "/admin";
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <Link href={`/admin/${classCode}`}>
          <Button
            icon={<ArrowLeftOutlined />}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              height: 38,
              width: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Link>
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 900,
              fontSize: "1.6rem",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            Налаштування класу
          </h1>
          <div style={{ color: "#868e96", fontWeight: 700, fontSize: "0.9rem" }}>
            {className}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px #000",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Паралель</div>
          <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 2 }}>
            Для фільтра в списку класів і в рейтингу.
          </div>
        </div>
        <Select
          style={{ width: 160 }}
          allowClear
          loading={savingParallel}
          disabled={savingParallel}
          placeholder="Клас (1–12)"
          value={parallels.find((p) => p.id === parallelId)?.name}
          onChange={onGradeChange}
          options={GRADE_OPTIONS}
        />
      </div>

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px #000",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>PIN-и учнів</div>
          <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 2 }}>
            PIN-и завжди видно у списку учнів. Тут лише друк і перегенерація.
          </div>
        </div>
        {!loading && students.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrintClassPinsButton
              classId={classId}
              publicCode={classCode}
              className={className}
              students={students}
            />
            <RegenerateClassPinsButton
              classId={classId}
              publicCode={classCode}
              className={className}
              students={students}
            />
          </div>
        )}
      </div>

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
        {/* Тоггл в одному рядку саме з тайтлом, не з усім блоком опису
            (живий фідбек) — раніше alignItems:"center" на всій картці
            центрував Switch проти багаторядкового опису, і він "плавав"
            десь посередині замість рівня заголовка. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Бали однокласників</div>
          <Switch checked={showClassmateStars} loading={savingVisibility} onChange={toggleClassmateStars} />
        </div>
        <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 8 }}>
          На публічному дашборді класу (без PIN-коду) учні бачать список класу.
          Тут можна дозволити показувати й кількість зірок кожного. Історію
          "за що", свою чи чужу, це не відкриває, її бачить лише сам учень
          через власний PIN.
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          borderRadius: 16,
          boxShadow: "4px 4px 0px #000",
          padding: 20,
        }}
      >
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            defaultActiveKey="individual"
            items={[
              {
                key: "individual",
                label: <span style={{ fontWeight: 800 }}>Індивідуальні нагороди</span>,
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="individual"
                    individualPrizes={individualPrizes}
                    onChanged={refresh}
                  />
                ),
              },
              {
                key: "class",
                label: <span style={{ fontWeight: 800 }}>Нагороди класу</span>,
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="class"
                    classPrizes={classPrizes}
                    onChanged={refresh}
                  />
                ),
              },
            ]}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 24,
          background: "#fff",
          border: "3px solid #000",
          boxShadow: "4px 4px 0px #e03131",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Небезпечна зона</div>
          <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 2 }}>
            Архів ховає клас зі списку, не видаляючи дані. Видалення остаточне.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button loading={busy} onClick={toggleArchive} className="btn-secondary">
            {archived ? "Повернути з архіву" : "Архівувати"}
          </Button>
          <Popconfirm
            title="Видалити клас назавжди?"
            description="Усі учні, уроки, бали й нагороди цього класу буде видалено безповоротно."
            onConfirm={deleteClassForever}
            okText="Видалити"
            okButtonProps={{ danger: true, className: "btn-danger-outline" }}
            cancelButtonProps={{ className: "btn-secondary" }}
            cancelText="Скасувати"
          >
            <Button danger loading={busy} className="btn-danger-outline">
              Видалити назавжди
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
