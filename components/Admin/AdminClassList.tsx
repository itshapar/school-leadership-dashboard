"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Tag } from "antd";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";
import type { OnboardingStepKey } from "@/lib/admin/onboarding";
import type { Parallel } from "@/lib/admin/parallels";
import { formatSemesterRange, semesterStatus, type Semester } from "@/lib/admin/semesters";
import StarIcon from "@/components/StarIcon";

/**
 * Плаский список класів кабінету.
 *
 * Картка класу навмисно мінімальна (Етап 9.2, live-фідбек): назва, кількість
 * учнів/уроків/зірок, Журнал і Дашборд. Паралель, код класу й прогрес
 * налаштування — це керування, а не щоденний перегляд, тож живуть глибше
 * в налаштуваннях класу, а не на кожній картці списку.
 *
 * Етап 10: над списком з'явився фільтр за семестром, і він головний. За
 * замовчуванням кабінет показує ПОТОЧНИЙ семестр, тобто те, над чим учитель
 * працює зараз; класи минулих семестрів нікуди не діваються, вони на сусідньому
 * чіпі й позначені як архів.
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
}: {
  classes: AdminClassCard[];
  parallels: Parallel[];
  semesters: Semester[];
  currentSemesterId: string | null;
}) {
  const atClassLimit =
    classes.filter((c) => !c.archived).length >= TEACHER_LIMITS.classes;

  // Класи, що лишились без семестру, бувають лише в одному випадку: семестр
  // видалили, а класи в ньому лишились (FK ставить semester_id у NULL).
  // Показуємо їх окремим чіпом, щоб вони не зникли з кабінету назовсім.
  const hasOrphans = classes.some((c) => !c.semester_id);

  const [semesterFilter, setSemesterFilter] = useState<string>(
    currentSemesterId ?? (hasOrphans ? NO_SEMESTER : ALL)
  );
  const [parallelFilter, setParallelFilter] = useState<string>(ALL);

  const bySemester = useMemo(() => {
    if (semesterFilter === ALL) return classes;
    if (semesterFilter === NO_SEMESTER) return classes.filter((c) => !c.semester_id);
    return classes.filter((c) => c.semester_id === semesterFilter);
  }, [classes, semesterFilter]);

  // Паралель — легкий тег без CRUD-екрана (lib/admin/parallels.ts): рядок
  // лишається в таблиці, навіть коли жоден клас на неї вже не посилається
  // (наприклад, клас перенесли в іншу паралель). Порожні паралелі ховаємо
  // з навігації чипів, а не показуємо як мертві кнопки без жодного класу.
  // Рахуємо їх від класів ВИДИМОГО семестру: у минулому році паралелі були
  // інші, і показувати їх поруч із поточними немає сенсу.
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

  const activeSemester = semesters.find((s) => s.id === semesterFilter) ?? null;

  return (
    <>
      {(semesters.length > 0 || hasOrphans) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSemesterFilter(s.id);
                  setParallelFilter(ALL);
                }}
                style={chipStyle(semesterFilter === s.id)}
              >
                {s.name}
              </button>
            ))}
            {hasOrphans && (
              <button
                type="button"
                onClick={() => {
                  setSemesterFilter(NO_SEMESTER);
                  setParallelFilter(ALL);
                }}
                style={chipStyle(semesterFilter === NO_SEMESTER)}
              >
                Без семестру
              </button>
            )}
            {semesters.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setSemesterFilter(ALL);
                  setParallelFilter(ALL);
                }}
                style={chipStyle(semesterFilter === ALL)}
              >
                Усі семестри
              </button>
            )}
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

          {activeSemester && (
            <div style={{ color: "#868e96", fontWeight: 600, fontSize: "0.8rem", marginTop: 8 }}>
              {formatSemesterRange(activeSemester)}
              {semesterStatus(activeSemester) === "past" && ", семестр завершено"}
              {semesterStatus(activeSemester) === "future" && ", семестр ще не почався"}
            </div>
          )}
        </div>
      )}

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
        У цьому семестрі ще немає класів
      </h3>
      <p style={{ color: "#868e96", fontWeight: 600, maxWidth: 460, margin: "0 auto" }}>
        Створіть новий клас або перенесіть наявний із попереднього семестру:
        відкрийте клас, далі налаштування, далі «Новий семестр».
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
