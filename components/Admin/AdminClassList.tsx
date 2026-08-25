"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Select, Tag } from "antd";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";
import type { OnboardingStepKey } from "@/lib/admin/onboarding";
import type { Parallel } from "@/lib/admin/parallels";
import {
  currentPeriod,
  isPeriodAvailable,
  listYearStarts,
  periodCode,
  periodLabel,
  periodOpensLabel,
  periodRangeLabel,
  periodStatus,
  schoolYearLabel,
  yearStartOf,
  type PeriodCode,
} from "@/lib/admin/periods";
import StarIcon from "@/components/StarIcon";

/**
 * Кабінет: два ряди табів згори, під дивайдером — усе, що до обраного періоду
 * належить (рейтинг, дашборд, паралелі, класи).
 *
 * Ряд перший — навчальний рік, ряд другий — семестри цього року. Це не
 * налаштування, а календар: періоди вбудовані, вчитель їх не створює й не
 * редагує (див. lib/admin/periods.ts). Таб вимкнений, поки період не настав,
 * тож наступний рік видно наперед, але зайти в нього можна лише тоді, коли
 * він почнеться.
 *
 * Дивайдер тут не декорація, а межа сенсу: усе нижче нього показує рівно той
 * період, який обрано вище.
 *
 * Картка класу лишається мінімальною (Етап 9.2, live-фідбек): назва,
 * кількість учнів/уроків/зірок, Журнал і Дашборд. Паралель, код класу й
 * прогрес налаштування живуть глибше, в налаштуваннях класу.
 */

const ALL = "__all__";

export interface AdminClassCard {
  id: string;
  name: string;
  public_code: string;
  formatted_code: string;
  parallel_id: string | null;
  period_code: PeriodCode;
  archived: boolean;
  is_demo: boolean;
  studentCount: number;
  lessonCount: number;
  totalStars: number;
  onboardingDone: number;
  onboardingTotal: number;
  onboardingComplete: boolean;
  nextStep: OnboardingStepKey;
}

export default function AdminClassList({
  classes,
  parallels,
  firstPeriod,
  children,
}: {
  classes: AdminClassCard[];
  parallels: Parallel[];
  /** Найраніший період, доступний цьому вчителю (див. firstAvailablePeriod). */
  firstPeriod: PeriodCode;
  /**
   * Рейтинг учнів і загальний дашборд: приходять зі сторінки готовими, щоб
   * лишитись серверними, але рендеряться ПІД дивайдером, уже всередині
   * обраного періоду.
   */
  children?: React.ReactNode;
}) {
  const atClassLimit =
    classes.filter((c) => !c.archived).length >= TEACHER_LIMITS.classes;

  const today = currentPeriod();

  // За замовчуванням відкриваємо поточний семестр, це те, над чим учитель
  // працює зараз. Виняток — коли в ньому ще немає жодного класу: тоді
  // показуємо останній період, де класи є, щоб кабінет не зустрічав людину
  // порожнім екраном одразу після зміни семестру.
  const initialPeriod = useMemo(() => {
    if (classes.some((c) => c.period_code === today)) return today;
    const latest = classes
      .map((c) => c.period_code)
      .filter((code) => code <= today)
      .sort()
      .pop();
    return latest ?? today;
  }, [classes, today]);

  const [period, setPeriod] = useState<PeriodCode>(initialPeriod);
  const [parallelFilter, setParallelFilter] = useState<string>(ALL);

  const yearStarts = useMemo(() => listYearStarts(firstPeriod), [firstPeriod]);
  const selectedYear = yearStartOf(period);

  const bySemester = useMemo(
    () => classes.filter((c) => c.period_code === period),
    [classes, period]
  );

  /** Перемикання року веде в найпізніший ДОСТУПНИЙ семестр цього року. */
  function selectYear(yearStart: number) {
    const candidates = ([1, 2] as const)
      .map((n) => periodCode(yearStart, n))
      .filter((code) => isPeriodAvailable(code, firstPeriod));
    const next = candidates.pop();
    if (!next) return;
    setPeriod(next);
    setParallelFilter(ALL);
  }

  // Паралель — легкий тег без CRUD-екрана (lib/admin/parallels.ts): рядок
  // лишається в таблиці, навіть коли жоден клас на неї вже не посилається.
  // Порожні паралелі ховаємо з навігації чипів, а не показуємо як мертві
  // кнопки. Рахуємо їх від класів ВИДИМОГО періоду: торік паралелі були інші.
  const sortedParallels = useMemo(() => {
    const withClasses = new Set(bySemester.map((c) => c.parallel_id).filter(Boolean));
    return [...parallels]
      .filter((p) => withClasses.has(p.id))
      .sort((a, b) => Number(a.name) - Number(b.name));
  }, [parallels, bySemester]);

  const visibleClasses =
    parallelFilter === ALL
      ? bySemester
      : bySemester.filter((c) => c.parallel_id === parallelFilter);

  return (
    <>
      {/* ── Ряд 1: навчальний рік ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {yearStarts.map((y) => {
          const available = ([1, 2] as const).some((n) =>
            isPeriodAvailable(periodCode(y, n), firstPeriod)
          );
          return (
            <button
              key={y}
              type="button"
              disabled={!available}
              onClick={() => selectYear(y)}
              title={available ? undefined : periodOpensLabel(periodCode(y, 1))}
              style={tabStyle(y === selectedYear, !available)}
            >
              {schoolYearLabel(y)}
            </button>
          );
        })}
      </div>

      {/* ── Ряд 2: семестри обраного року ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([1, 2] as const).map((n) => {
          const code = periodCode(selectedYear, n);
          const available = isPeriodAvailable(code, firstPeriod);
          return (
            <button
              key={code}
              type="button"
              disabled={!available}
              onClick={() => {
                setPeriod(code);
                setParallelFilter(ALL);
              }}
              title={available ? undefined : periodOpensLabel(code)}
              style={tabStyle(code === period, !available)}
            >
              {periodLabel(code)}
            </button>
          );
        })}
      </div>

      <div style={{ color: "#868e96", fontWeight: 600, fontSize: "0.8rem", margin: "10px 0 0" }}>
        {periodRangeLabel(period)}
        {periodStatus(period) === "past" && ", семестр завершено"}
        {periodStatus(period) === "current" && ", триває зараз"}
      </div>

      {/* Дивайдер — межа сенсу: усе нижче показує рівно обраний період. */}
      <div style={{ height: 3, background: "#000", borderRadius: 2, margin: "20px 0 24px" }} />

      {children}

      {sortedParallels.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <button type="button" onClick={() => setParallelFilter(ALL)} style={chipStyle(parallelFilter === ALL)}>
            Усі паралелі
          </button>
          {sortedParallels.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParallelFilter(p.id)}
              style={chipStyle(parallelFilter === p.id)}
            >
              {p.name} клас
            </button>
          ))}
        </div>
      )}

      {/* Заголовок «Класи», дивайдер і кнопка «Новий клас» звідси прибрані
          (живий фідбек): кнопка переїхала нагору, до «Профілю вчителя», а
          заголовок над списком карток нічого не додавав. */}
      {atClassLimit && (
        <div style={{ marginBottom: 12, color: "#868e96", fontWeight: 600, fontSize: "0.82rem" }}>
          Досягнуто ліміт: {TEACHER_LIMITS.classes} активних класів на акаунт.
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState />
      ) : visibleClasses.length === 0 ? (
        <EmptySemesterState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleClasses.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}

    </>
  );
}

/**
 * Чіп фільтра. Обводка й тінь чорні в обох станах (живий фідбек):
 * помаранчевий контур обраного чіпа був єдиним місцем, де колір зірки
 * працював як обводка, і сіра обводка неактивних випадала з решти кнопок.
 */
/**
 * Таб періоду. Той самий каркас, що й у чипів паралелей, бо це та сама дія —
 * перемикання зрізу. Вимкнений стан без сірої заливки (правило кнопок у
 * globals.css): обводка лишається чорною, «недоступність» показує прозорість
 * і відсутність тіні, інакше таб читався б як зламаний, а не як «ще не час».
 */
function tabStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 18px",
    borderRadius: "20px",
    background: active ? "#000" : "#ffffff",
    color: active ? "#fff" : "#000000",
    fontWeight: 800,
    fontSize: "0.9rem",
    border: "2px solid #000000",
    boxShadow: disabled ? "none" : "2px 2px 0px #000000",
    opacity: disabled ? 0.35 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: "20px",
    background: active ? "#000" : "#ffffff",
    color: active ? "#fff" : "#000000",
    fontWeight: 600,
    fontSize: "0.9rem",
    border: "2px solid #000000",
    boxShadow: "2px 2px 0px #000000",
    cursor: "pointer",
  };
}

function ClassCard({ cls }: { cls: AdminClassCard }) {
  return (
    <div className="star-card" style={{ padding: 0, opacity: cls.archived ? 0.72 : 1 }}>
      <div className="admin-card-row">
        <div className="admin-card-info">
          <div className="admin-class-name" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {cls.name}
            {cls.archived && (
              <Tag style={{ fontWeight: 800, margin: 0, border: "2px solid #000", background: "#f1f3f5", color: "#000" }}>
                АРХІВ
              </Tag>
            )}
            {cls.is_demo && (
              <Tag color="purple" style={{ fontWeight: 800, margin: 0 }}>
                🧪 ДЕМО
              </Tag>
            )}
          </div>

          <div className="admin-class-stats">
            <span>{cls.studentCount} учнів</span>
            <span>{cls.lessonCount} уроків</span>
            <span className="admin-stars-count">
              {cls.totalStars} <StarIcon size="0.9em" color="currentColor" />
            </span>
          </div>
        </div>

        <div className="admin-btn-group">
          {/* Дашборд ліворуч, журнал праворуч (живий фідбек): кожна кнопка
              лишається собою, міняється лише порядок. */}
          <Link
            href={`/class/${cls.public_code}`}
            target="_blank"
            className="admin-action-btn admin-btn-white"
          >
            Дашборд
          </Link>
          <Link href={`/admin/${cls.public_code}`} className="admin-action-btn admin-btn-black">
            {cls.archived ? "Переглянути" : "Журнал"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptySemesterState() {
  return (
    <div
      className="star-card"
      style={{
        textAlign: "center",
        padding: "40px 24px",
        border: "3px dashed #ced4da",
        boxShadow: "none",
      }}
    >
      <h3 style={{ fontWeight: 900, fontSize: "1.2rem", margin: "0 0 8px" }}>
        У цьому періоді ще немає класів
      </h3>
      <p style={{ color: "#868e96", fontWeight: 600, maxWidth: 460, margin: "0 auto" }}>
        Створіть новий клас або перенесіть наявний із попереднього семестру:
        відкрийте клас, далі налаштування, далі «Перейти в новий семестр».
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="star-card"
      style={{
        textAlign: "center",
        padding: "48px 24px",
        border: "3px dashed #ced4da",
        boxShadow: "none",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: 12 }}>🚀</div>
      <h3 style={{ fontWeight: 900, fontSize: "1.4rem", margin: "0 0 8px" }}>
        Створіть перший клас
      </h3>
      <p style={{ color: "#868e96", fontWeight: 600, maxWidth: 420, margin: "0 auto 24px" }}>
        Майстер проведе за три кроки: клас, учні, нагороди. Будь-який крок можна
        пропустити й повернутись пізніше.
      </p>
      <Link href="/admin/onboarding">
        <Button type="primary" size="large" className="btn-primary">
          ПОЧАТИ
        </Button>
      </Link>
    </div>
  );
}
