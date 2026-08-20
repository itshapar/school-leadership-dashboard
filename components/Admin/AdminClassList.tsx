"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Modal, Popconfirm, Select, Tag, message } from "antd";
import {
  DownOutlined,
  ExperimentOutlined,
  FolderOutlined,
  PlusOutlined,
  StarFilled,
} from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import {
  moveClassToFolder,
  type FolderNode,
  type Parallel,
  type School,
} from "@/lib/admin/folders";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";

/**
 * Список класів кабінету, згрупований у «папки» школа → паралель.
 *
 * Папки опціональні: клас може лежати ніде, і тоді він у кошику «Без папки».
 * Дерево будує чистa функція buildFolderTree на сервері — тут лише рендер,
 * згортання і переміщення.
 */

export interface AdminClassCard {
  id: string;
  name: string;
  public_code: string;
  formatted_code: string;
  school_id: string | null;
  parallel_id: string | null;
  is_demo: boolean;
  archived: boolean;
  studentCount: number;
  lessonCount: number;
  totalStars: number;
  onboardingDone: number;
  onboardingTotal: number;
  onboardingComplete: boolean;
}

const NO_FOLDER = "__none__";

export default function AdminClassList({
  tree,
  schools,
  parallels,
  totalClasses,
  hasDemo,
}: {
  tree: FolderNode<AdminClassCard>[];
  schools: School[];
  parallels: Parallel[];
  totalClasses: number;
  hasDemo: boolean;
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [moving, setMoving] = useState<AdminClassCard | null>(null);
  const [targetSchool, setTargetSchool] = useState<string>(NO_FOLDER);
  const [targetParallel, setTargetParallel] = useState<string>(NO_FOLDER);
  const [savingMove, setSavingMove] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const atClassLimit = totalClasses >= TEACHER_LIMITS.classes;

  const parallelOptions = useMemo(() => {
    const scoped =
      targetSchool === NO_FOLDER
        ? parallels.filter((p) => !p.school_id)
        : parallels.filter((p) => p.school_id === targetSchool);
    return [
      { value: NO_FOLDER, label: "— без паралелі" },
      ...scoped.map((p) => ({ value: p.id, label: p.name })),
    ];
  }, [parallels, targetSchool]);

  function openMove(cls: AdminClassCard) {
    setMoving(cls);
    setTargetSchool(cls.school_id ?? NO_FOLDER);
    setTargetParallel(cls.parallel_id ?? NO_FOLDER);
  }

  async function saveMove() {
    if (!moving) return;
    setSavingMove(true);
    const { error } = await moveClassToFolder(supabase, moving.id, {
      schoolId: targetSchool === NO_FOLDER ? null : targetSchool,
      parallelId: targetParallel === NO_FOLDER ? null : targetParallel,
    });
    setSavingMove(false);

    if (error) {
      message.error("Не вдалося перемістити клас");
      return;
    }
    message.success("Клас переміщено");
    setMoving(null);
    router.refresh();
  }

  async function createDemo() {
    setDemoBusy(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/demo", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка");
      message.success(json.existed ? "Демо-клас уже існує" : "Демо-клас створено");
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Не вдалося створити демо-клас");
    } finally {
      setDemoBusy(false);
    }
  }

  async function deleteDemo() {
    setDemoBusy(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/demo", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка");
      message.success("Демо-дані видалено");
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Не вдалося видалити демо-дані");
    } finally {
      setDemoBusy(false);
    }
  }

  const isEmpty = totalClasses === 0;

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

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {hasDemo && (
            <Popconfirm
              title="Видалити демо-дані?"
              description="Демо-клас разом з усіма фейковими учнями і зірками буде видалено назавжди."
              onConfirm={deleteDemo}
              okText="Видалити"
              cancelText="Ні"
            >
              <Button danger loading={demoBusy} style={{ fontWeight: 800, borderRadius: 10 }}>
                Видалити демо-дані
              </Button>
            </Popconfirm>
          )}

          <Dropdown
            disabled={atClassLimit}
            menu={{
              items: [
                {
                  key: "wizard",
                  icon: <PlusOutlined />,
                  label: "Майстер: створити клас",
                  onClick: () => router.push("/admin/onboarding"),
                },
                {
                  key: "demo",
                  icon: <ExperimentOutlined />,
                  label: hasDemo ? "Перейти в демо-клас" : "Створити демо-клас",
                  onClick: createDemo,
                },
              ],
            }}
          >
            <Button
              type="primary"
              style={{ background: "#000", borderColor: "#000", fontWeight: 800, borderRadius: 10 }}
            >
              <PlusOutlined /> Новий клас <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      {atClassLimit && (
        <div style={{ marginBottom: 12, color: "#868e96", fontWeight: 700, fontSize: "0.82rem" }}>
          Досягнуто ліміт: {TEACHER_LIMITS.classes} класів на акаунт.
        </div>
      )}

      {isEmpty ? (
        <EmptyState onDemo={createDemo} demoBusy={demoBusy} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {tree.map((node) => (
            <FolderSection
              key={node.school?.id ?? "root"}
              node={node}
              onMove={openMove}
            />
          ))}
        </div>
      )}

      <Modal
        title={<div style={{ fontWeight: 900, textTransform: "uppercase" }}>Перемістити клас</div>}
        open={moving !== null}
        onOk={saveMove}
        onCancel={() => setMoving(null)}
        confirmLoading={savingMove}
        okText="Перемістити"
        cancelText="Скасувати"
        okButtonProps={{ style: { background: "#000", fontWeight: 700 } }}
      >
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontWeight: 700 }}>{moving?.name}</div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>
              Школа
            </label>
            <Select
              style={{ width: "100%" }}
              value={targetSchool}
              onChange={(v) => {
                setTargetSchool(v);
                setTargetParallel(NO_FOLDER); // паралелі прив'язані до школи
              }}
              options={[
                { value: NO_FOLDER, label: "— без школи" },
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: "0.85rem" }}>
              Паралель
            </label>
            <Select
              style={{ width: "100%" }}
              value={targetParallel}
              onChange={setTargetParallel}
              options={parallelOptions}
            />
            <div style={{ color: "#868e96", fontSize: "0.78rem", marginTop: 6 }}>
              Якщо обрати паралель, школа візьметься з неї автоматично.
            </div>
          </div>

          {schools.length === 0 && parallels.length === 0 && (
            <div style={{ fontSize: "0.82rem", color: "#868e96" }}>
              Папок ще немає —{" "}
              <Link href="/admin/folders" style={{ fontWeight: 700 }}>
                створіть школу або паралель
              </Link>
              .
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function FolderSection({
  node,
  onMove,
}: {
  node: FolderNode<AdminClassCard>;
  onMove: (cls: AdminClassCard) => void;
}) {
  const [open, setOpen] = useState(true);
  const classCount = node.parallels.reduce((n, b) => n + b.classes.length, 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          padding: "0 0 10px",
          cursor: "pointer",
          fontWeight: 900,
          fontSize: "0.95rem",
          textTransform: "uppercase",
          color: "#495057",
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          ▸
        </span>
        <FolderOutlined />
        {node.school?.name ?? "Без школи"}
        <span style={{ color: "#adb5bd", fontWeight: 700 }}>({classCount})</span>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: 8 }}>
          {node.parallels.map((bucket) => (
            <div key={bucket.parallel?.id ?? "loose"}>
              {bucket.parallel && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    color: "#868e96",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {bucket.parallel.name} паралель
                </div>
              )}
              {bucket.classes.length === 0 ? (
                <div style={{ color: "#adb5bd", fontSize: "0.82rem", fontWeight: 600 }}>
                  Порожньо
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {bucket.classes.map((cls) => (
                    <ClassCard key={cls.id} cls={cls} onMove={onMove} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({
  cls,
  onMove,
}: {
  cls: AdminClassCard;
  onMove: (cls: AdminClassCard) => void;
}) {
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
              href={`/admin/onboarding?classId=${cls.id}`}
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
          <button
            type="button"
            onClick={() => onMove(cls)}
            className="admin-action-btn admin-btn-white"
            style={{ cursor: "pointer" }}
          >
            Перемістити
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onDemo, demoBusy }: { onDemo: () => void; demoBusy: boolean }) {
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
        Майстер проведе за п&apos;ять кроків: клас → учні → система балів → призи →
        коди й PIN-и для учнів. Будь-який крок можна пропустити й повернутись пізніше.
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
      <div style={{ marginTop: 16 }}>
        <Button type="link" onClick={onDemo} loading={demoBusy} style={{ fontWeight: 700 }}>
          Спробувати на демо-класі
        </Button>
      </div>
    </div>
  );
}
