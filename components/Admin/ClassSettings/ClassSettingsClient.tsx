"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Popconfirm, Select, Switch, message } from "antd";
import { Trash } from "@phosphor-icons/react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setClassParallel, upsertParallelByName, type Parallel } from "@/lib/admin/parallels";
import BackButton from "@/components/BackButton";

// Той самий фіксований список 1–12, що й у майстрі створення класу.
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `${n} клас` };
});

/**
 * Налаштування класу: назва, паралель, видимість зірок однокласників і
 * небезпечна зона.
 *
 * Система балів (типи нарахувань) тут не редагується — Етап 9 зробив її
 * фіксованим стандартом для всіх класів (накочується автоматично при
 * створенні, див. OnboardingWizard.createClass). PIN-и переїхали в список
 * учнів, нагороди — на власну сторінку /admin/[code]/prizes (живий
 * фідбек): і те, і те шукали не тут.
 */

interface Props {
  classId: string;
  classCode: string;
  className: string;
  initialShowClassmateStars: boolean;
  initialParallelId: string | null;
  parallels: Parallel[];
}

export default function ClassSettingsClient({
  classId,
  classCode,
  className,
  initialShowClassmateStars,
  initialParallelId,
  parallels,
}: Props) {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [showClassmateStars, setShowClassmateStars] = useState(initialShowClassmateStars);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [parallelId, setParallelId] = useState(initialParallelId);
  const [savingParallel, setSavingParallel] = useState(false);
  const [name, setName] = useState(className);
  const [savingName, setSavingName] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * Назва класу редагується вже після створення (живий фідбек): у майстрі
   * її вводять поспіхом, а перейменувати клас потім не було де взагалі.
   * Обрізаємо пробіли й тримаємо ту саму межу в 60 символів, що й у
   * майстрі, щоб довга назва не ламала верстку картки в кабінеті.
   */
  async function saveName() {
    const next = name.trim();
    if (!next) {
      message.error("Назва не може бути порожньою");
      return;
    }
    if (next.length > 60) {
      message.error("Занадто довга назва");
      return;
    }
    setSavingName(true);
    const { error } = await supabase.from("classes").update({ name: next }).eq("id", classId);
    setSavingName(false);
    if (error) {
      message.error("Не вдалося змінити назву");
      return;
    }
    setName(next);
    message.success("Назву класу змінено");
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
        <BackButton href={`/admin/${classCode}`} label="Назад до журналу" />
        {/* Без дубля назви класу під заголовком (живий фідбек): вона й так
            стоїть окремою карткою «Назва класу» одразу нижче. */}
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
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Назва класу</div>
          <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 2 }}>
            Так клас підписаний у кабінеті, журналі й на дашборді для учнів.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input
            value={name}
            maxLength={60}
            disabled={savingName}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={saveName}
            placeholder="7-А, ПМ2…"
            style={{ width: 200 }}
          />
          <Button
            className="btn-primary"
            loading={savingName}
            disabled={!name.trim() || name.trim() === className}
            onClick={saveName}
          >
            Зберегти
          </Button>
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

      {/* Блок PIN-ів прибрано (живий фідбек): друк і перегенерація живуть
          у списку учнів, поряд із самими PIN-ами, і дублювати їх тут не
          було потреби. */}
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
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Конкурентне середовище</div>
          <Switch checked={showClassmateStars} loading={savingVisibility} onChange={toggleClassmateStars} />
        </div>
        <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 8 }}>
          Коли опцію увімкнено, учні бачать кількість зірок одне одного у
          списку класу. Якщо її вимкнути, кожен учень бачитиме лише власні
          зірки. Детальна історія нарахувань завжди залишається приватною та
          доступна лише за особистим PIN-кодом.
        </div>
      </div>

      {/* Нагороди переїхали на власну сторінку /admin/[code]/prizes
          (живий фідбек): вчитель ходить у них частіше, ніж у решту
          налаштувань, і шукає їх із журналу, а не тут. */}
      <div
        style={{
          marginTop: 24,
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
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>Небезпечна зона</div>
          <div style={{ color: "#868e96", fontSize: "0.8rem", marginTop: 2 }}>
            Видалення остаточне: разом із класом зникають усі учні, уроки,
            зірки й нагороди.
          </div>
        </div>
        {/* Архів прибрано повністю (живий фідбек): функція не знадобилась
            жодного разу, а «сховати клас» плутали з «видалити». */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Popconfirm
            title="Видалити клас назавжди?"
            description="Усі учні, уроки, бали й нагороди цього класу буде видалено безповоротно."
            onConfirm={deleteClassForever}
            okText="Видалити"
            okButtonProps={{ danger: true, className: "btn-danger-outline" }}
            cancelButtonProps={{ className: "btn-secondary" }}
            cancelText="Скасувати"
          >
            <Button danger icon={<Trash />} loading={busy} className="btn-danger-outline">
              Видалити назавжди
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
