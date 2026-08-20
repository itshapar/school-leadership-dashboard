"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Popover, Select, Tag, message } from "antd";
import { PlusOutlined, StarFilled, TagOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setClassParallel, upsertParallelByName, type Parallel } from "@/lib/admin/parallels";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";
import type { OnboardingStepKey } from "@/lib/admin/onboarding";

/**
 * Плаский список класів кабінету.
 *
 * До Етапу 9 тут було дерево "школа → паралель" з окремим екраном
 * керування папками. Школа прибрана з класу зовсім (є вільним текстом у
 * профілі вчителя); паралель лишилась як необов'язковий тег, який можна
 * змінити прямо тут — без переходу нікуди.
 */

// Той самий фіксований список 1–12, що й у майстрі створення класу.
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `${n} клас` };
});

export interface AdminClassCard {
  id: string;
  name: string;
  public_code: string;
  formatted_code: string;
  parallel_id: string | null;
  is_demo: boolean;
  archived: boolean;
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

  return (
    <>
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
          disabled={atClassLimit}
          onClick={() => router.push("/admin/onboarding")}
          style={{ background: "#000", borderColor: "#000", fontWeight: 800, borderRadius: 10 }}
        >
          <PlusOutlined /> Новий клас
        </Button>
      </div>

      {atClassLimit && (
        <div style={{ marginBottom: 12, color: "#868e96", fontWeight: 700, fontSize: "0.82rem" }}>
          Досягнуто ліміт: {TEACHER_LIMITS.classes} класів на акаунт.
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} parallels={parallels} />
          ))}
        </div>
      )}
    </>
  );
}

function ClassCard({ cls, parallels }: { cls: AdminClassCard; parallels: Parallel[] }) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentParallel = parallels.find((p) => p.id === cls.parallel_id) ?? null;

  async function applyParallel(value: string | null) {
    setSaving(true);
    const { error } = await setClassParallel(supabase, cls.id, value);
    setSaving(false);
    if (error) {
      message.error("Не вдалося змінити паралель");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function onGradeChange(grade: string | undefined) {
    if (!grade) {
      await applyParallel(null);
      return;
    }
    setSaving(true);
    const { id, error } = await upsertParallelByName(supabase, grade);
    if (error || !id) {
      setSaving(false);
      message.error("Не вдалося змінити паралель");
      return;
    }
    await applyParallel(id);
  }

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
            {cls.archived && (
              <Tag style={{ fontWeight: 800, margin: 0 }}>Архів</Tag>
            )}
            <Popover
              trigger="click"
              open={open}
              onOpenChange={setOpen}
              content={
                <div style={{ width: 180 }}>
                  <Select
                    style={{ width: "100%" }}
                    placeholder="Клас (1–12)"
                    allowClear
                    loading={saving}
                    disabled={saving}
                    value={currentParallel?.name}
                    onChange={onGradeChange}
                    options={GRADE_OPTIONS}
                  />
                </div>
              }
            >
              <Tag
                icon={<TagOutlined />}
                style={{ cursor: "pointer", fontWeight: 700, margin: 0 }}
              >
                {currentParallel?.name ?? "паралель"}
              </Tag>
            </Popover>
          </div>

          <div className="admin-class-stats">
            <span>{cls.studentCount} учнів</span>
            <span>{cls.lessonCount} уроків</span>
            <span className="admin-stars-count">
              {cls.totalStars} <StarFilled style={{ fontSize: "0.9rem" }} />
            </span>
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "0.8rem",
              fontWeight: 800,
              letterSpacing: "1px",
              color: "var(--color-text-muted)",
            }}
          >
            Код для учнів: {cls.formatted_code}
          </div>

          {!cls.onboardingComplete && (
            <Link
              href={
                cls.nextStep === "codes"
                  ? `/admin/${cls.public_code}/settings`
                  : `/admin/onboarding?classId=${cls.id}`
              }
              style={{
                display: "inline-block",
                marginTop: 8,
                fontSize: "0.78rem",
                fontWeight: 800,
                color: "#f08c00",
                textDecoration: "none",
                border: "2px solid #f08c00",
                borderRadius: 8,
                padding: "2px 8px",
              }}
            >
              Налаштувати · {cls.onboardingDone}/{cls.onboardingTotal}
            </Link>
          )}
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
        Майстер проведе за три кроки: клас → учні → призи. Будь-який крок можна
        пропустити й повернутись пізніше.
      </p>
      <Link href="/admin/onboarding">
        <Button
          type="primary"
          size="large"
          style={{ background: "#000", borderColor: "#000", fontWeight: 900, borderRadius: 12 }}
        >
          ПОЧАТИ
        </Button>
      </Link>
    </div>
  );
}
