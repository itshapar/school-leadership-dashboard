"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Select, Tag } from "antd";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";
import type { OnboardingStepKey } from "@/lib/admin/onboarding";
import type { Parallel } from "@/lib/admin/parallels";
import {
  formatSemesterRange,
  groupBySchoolYear,
  schoolYearOf,
  semesterChipLabel,
  semesterStatus,
  type Semester,
} from "@/lib/admin/semesters";
import StarIcon from "@/components/StarIcon";

/**
 * Кабінет: вибір періоду згори, під дивайдером — усе, що до цього періоду
 * належить (рейтинг, дашборд, паралелі, класи).
 *
 * Ієрархія навмисно двоступенева (живий фідбек): навчальний рік випадайкою,
 * семестри цього року — перемикачами під нею, тими самими, що й паралелі
 * нижче. Плаский список усіх семестрів підряд розмивав картинку: «I семестр
 * 2025/2026» і «II семестр 2026/2027» стояли поруч як рівні, хоча це різні
 * роки. Рік — це те, що обирають рідко, семестр — те, що перемикають.
 *
 * Дивайдер тут не декорація, а межа сенсу: усе нижче нього показує рівно той
 * період, який обрано вище.
 *
 * Картка класу лишається мінімальною (Етап 9.2, live-фідбек): назва,
 * кількість учнів/уроків/зірок, Журнал і Дашборд. Паралель, код класу й
 * прогрес налаштування живуть глибше, в налаштуваннях класу.
 */

const ALL = "__all__";
const NO_SEMESTER = "__none__";

export interface AdminClassCard {
  id: string;
  name: string;
  public_code: string;
  formatted_code: string;
  parallel_id: string | null;
  semester_id: string | null;
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
  semesters,
  currentSemesterId,
  children,
}: {
  classes: AdminClassCard[];
  parallels: Parallel[];
  semesters: Semester[];
  currentSemesterId: string | null;
  /**
   * Рейтинг учнів і загальний дашборд: приходять зі сторінки готовими, щоб
   * лишитись серверними, але рендеряться ПІД дивайдером, уже всередині
   * обраного періоду.
   */
  children?: React.ReactNode;
}) {
  const atClassLimit =
    classes.filter((c) => !c.archived).length >= TEACHER_LIMITS.classes;

  // Класи без семестру бувають в одному випадку: семестр видалили, а класи в
  // ньому лишились (FK ставить semester_id у NULL). Показуємо їх окремим
  // пунктом року, щоб вони не зникли з кабінету назовсім.
  const hasOrphans = classes.some((c) => !c.semester_id);

  const years = useMemo(() => groupBySchoolYear(semesters), [semesters]);

  const currentSemester = semesters.find((s) => s.id === currentSemesterId) ?? null;

  const [year, setYear] = useState<string>(
    currentSemester ? schoolYearOf(currentSemester) : years[0]?.year ?? NO_SEMESTER
  );
  const [semesterFilter, setSemesterFilter] = useState<string>(currentSemesterId ?? ALL);
  const [parallelFilter, setParallelFilter] = useState<string>(ALL);

  const yearSemesters = years.find((y) => y.year === year)?.semesters ?? [];

  // Один семестр у році — перемикати нема чого, він і є весь рік.
  const effectiveSemesterId =
    year === NO_SEMESTER
      ? NO_SEMESTER
      : yearSemesters.length === 1
      ? yearSemesters[0].id
      : yearSemesters.some((s) => s.id === semesterFilter)
      ? semesterFilter
      : ALL;

  const selectedSemester =
    yearSemesters.find((s) => s.id === effectiveSemesterId) ?? null;

  const bySemester = useMemo(() => {
    if (effectiveSemesterId === NO_SEMESTER) return classes.filter((c) => !c.semester_id);
    if (effectiveSemesterId === ALL) {
      const ids = new Set(yearSemesters.map((s) => s.id));
      return classes.filter((c) => c.semester_id && ids.has(c.semester_id));
    }
    return classes.filter((c) => c.semester_id === effectiveSemesterId);
  }, [classes, effectiveSemesterId, yearSemesters]);

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

  const yearOptions = [
    ...years.map((y) => ({ value: y.year, label: `${y.year} навчальний рік` })),
    ...(hasOrphans ? [{ value: NO_SEMESTER, label: "Без семестру" }] : []),
  ];

  return (
    <>
      {yearOptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: yearSemesters.length > 1 ? 12 : 0,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#868e96",
              }}
            >
              Навчальний рік
            </span>
            <Select
              className="year-select"
              value={year}
              onChange={(next) => {
                setYear(next);
                setSemesterFilter(ALL);
                setParallelFilter(ALL);
              }}
              options={yearOptions}
              style={{ minWidth: 240 }}
            />
            <Link
              href="/admin/semesters"
              style={{
                marginLeft: "auto",
                fontWeight: 600,
                fontSize: "0.82rem",
                color: "#495057",
                textDecoration: "underline",
              }}
            >
              Керувати семестрами
            </Link>
          </div>

          {yearSemesters.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  setSemesterFilter(ALL);
                  setParallelFilter(ALL);
                }}
                style={chipStyle(effectiveSemesterId === ALL)}
              >
                Увесь рік
              </button>
              {yearSemesters.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSemesterFilter(s.id);
                    setParallelFilter(ALL);
                  }}
                  style={chipStyle(effectiveSemesterId === s.id)}
                >
                  {semesterChipLabel(s.name)}
                </button>
              ))}
            </div>
          )}

          {selectedSemester && (
            <div style={{ color: "#868e96", fontWeight: 600, fontSize: "0.8rem", marginTop: 10 }}>
              {formatSemesterRange(selectedSemester)}
              {semesterStatus(selectedSemester) === "past" && ", семестр завершено"}
              {semesterStatus(selectedSemester) === "future" && ", семестр ще не почався"}
            </div>
          )}
        </div>
      )}

      {/* Дивайдер малюємо лише разом із блоком періоду: без нього це була б
          просто риска нізвідки над рейтингом. */}
      {yearOptions.length > 0 && (
        <div style={{ height: 3, background: "#000", borderRadius: 2, margin: "0 0 24px" }} />
      )}

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

      {/* Випадайка року мусить читатись як рідня чипам під нею: та сама чорна
          обводка, та сама зміщена тінь, та сама пігулка. Інакше сірий бордер
          antd за замовчуванням виглядає чужим елементом просто над чипами. */}
      <style jsx global>{`
        .year-select .ant-select-selector {
          border: 2px solid #000000 !important;
          box-shadow: 2px 2px 0px #000000 !important;
          border-radius: 20px !important;
          height: 40px !important;
          padding: 0 16px !important;
        }
        .year-select .ant-select-selection-item {
          line-height: 36px !important;
          font-weight: 800 !important;
        }
        .year-select .ant-select-arrow {
          color: #000000 !important;
        }
      `}</style>
    </>
  );
}

/**
 * Чіп фільтра. Обводка й тінь чорні в обох станах (живий фідбек):
 * помаранчевий контур обраного чіпа був єдиним місцем, де колір зірки
 * працював як обводка, і сіра обводка неактивних випадала з решти кнопок.
 */
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
