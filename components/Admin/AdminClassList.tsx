"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Tag } from "antd";
import { Plus } from "@phosphor-icons/react";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";
import type { OnboardingStepKey } from "@/lib/admin/onboarding";
import type { Parallel } from "@/lib/admin/parallels";
import StarIcon from "@/components/StarIcon";

/**
 * Плаский список класів кабінету.
 *
 * Картка класу навмисно мінімальна (Етап 9.2, live-фідбек): назва, кількість
 * учнів/уроків/зірок, Журнал і Дашборд. Паралель, код класу й прогрес
 * налаштування — це керування, а не щоденний перегляд, тож живуть глибше
 * в налаштуваннях класу, а не на кожній картці списку.
 */

const ALL = "__all__";

export interface AdminClassCard {
  id: string;
  name: string;
  public_code: string;
  formatted_code: string;
  parallel_id: string | null;
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
}: {
  classes: AdminClassCard[];
  parallels: Parallel[];
}) {
  const router = useRouter();
  const atClassLimit = classes.length >= TEACHER_LIMITS.classes;

  // Паралель — легкий тег без CRUD-екрана (lib/admin/parallels.ts): рядок
  // лишається в таблиці, навіть коли жоден клас на неї вже не посилається
  // (наприклад, клас перенесли в іншу паралель). Порожні паралелі ховаємо
  // з навігації чипів, а не показуємо як мертві кнопки без жодного класу.
  const sortedParallels = useMemo(() => {
    const withClasses = new Set(classes.map((c) => c.parallel_id).filter(Boolean));
    return [...parallels]
      .filter((p) => withClasses.has(p.id))
      .sort((a, b) => Number(a.name) - Number(b.name));
  }, [parallels, classes]);
  const [parallelFilter, setParallelFilter] = useState<string>(ALL);
  const visibleClasses =
    parallelFilter === ALL
      ? classes
      : classes.filter((c) => c.parallel_id === parallelFilter);

  return (
    <>
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", opacity: 0.5 }}>
          Класи
        </h2>

        <Button
          type="primary"
          icon={<Plus />}
          disabled={atClassLimit}
          onClick={() => router.push("/admin/onboarding")}
          className="btn-primary"
        >
          Новий клас
        </Button>
      </div>

      {atClassLimit && (
        <div style={{ marginBottom: 12, color: "#868e96", fontWeight: 600, fontSize: "0.82rem" }}>
          Досягнуто ліміт: {TEACHER_LIMITS.classes} класів на акаунт.
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState />
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
    <div className="star-card" style={{ padding: 0 }}>
      <div className="admin-card-row">
        <div className="admin-card-info">
          <div className="admin-class-name" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {cls.name}
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
          <Link href={`/admin/${cls.public_code}`} className="admin-action-btn admin-btn-black">
            Журнал
          </Link>
          <Link
            href={`/class/${cls.public_code}`}
            target="_blank"
            className="admin-action-btn admin-btn-white"
          >
            Дашборд
          </Link>
        </div>
      </div>
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
