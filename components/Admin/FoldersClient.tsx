"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Table, Tag, message } from "antd";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadParallels, loadSchools, type Parallel, type School } from "@/lib/admin/folders";
import { TEACHER_LIMITS } from "@/lib/admin/classConfig";

/**
 * Школи та паралелі — опціональні «папки» вчителя (міграція 014).
 *
 * Два нюанси, які тут закодовані явно:
 *  • паралель МОЖЕ існувати без школи (кейс автора: паралель «7» без школи);
 *  • видалення папки — завжди soft delete: композитні FK мають
 *    ON DELETE SET NULL, тож фізичне видалення тихо відв'язало б класи.
 *    Класи при цьому не зникають, лише лишаються без папки.
 */

const NO_SCHOOL = "__none__";

export default function FoldersClient() {
  const supabase = getSupabaseClient();

  const [schools, setSchools] = useState<School[]>([]);
  const [parallels, setParallels] = useState<Parallel[]>([]);
  const [classCounts, setClassCounts] = useState<{
    bySchool: Map<string, number>;
    byParallel: Map<string, number>;
  }>({ bySchool: new Map(), byParallel: new Map() });
  const [loading, setLoading] = useState(true);

  const [schoolModal, setSchoolModal] = useState<School | "new" | null>(null);
  const [parallelModal, setParallelModal] = useState<Parallel | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [schoolForm] = Form.useForm<{ name: string }>();
  const [parallelForm] = Form.useForm<{ name: string; school_id: string }>();

  const refresh = useCallback(async () => {
    const [s, p, classesRes] = await Promise.all([
      loadSchools(supabase),
      loadParallels(supabase),
      supabase
        .from("classes")
        .select("id, school_id, parallel_id")
        .is("deleted_at", null),
    ]);

    const bySchool = new Map<string, number>();
    const byParallel = new Map<string, number>();
    ((classesRes.data ?? []) as Array<{ school_id: string | null; parallel_id: string | null }>)
      .forEach((c) => {
        if (c.school_id) bySchool.set(c.school_id, (bySchool.get(c.school_id) ?? 0) + 1);
        if (c.parallel_id) byParallel.set(c.parallel_id, (byParallel.get(c.parallel_id) ?? 0) + 1);
      });

    setSchools(s);
    setParallels(p);
    setClassCounts({ bySchool, byParallel });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSchool(values: { name: string }) {
    setSaving(true);
    const payload = { name: values.name.trim() };
    const { error } =
      schoolModal && schoolModal !== "new"
        ? await supabase.from("schools").update(payload).eq("id", schoolModal.id)
        : await supabase.from("schools").insert({ ...payload, sort_order: schools.length + 1 });
    setSaving(false);

    if (error) {
      reportFolderError(error, "школа", TEACHER_LIMITS.schools);
      return;
    }
    message.success("Збережено");
    setSchoolModal(null);
    void refresh();
  }

  async function saveParallel(values: { name: string; school_id: string }) {
    setSaving(true);
    const payload = {
      name: values.name.trim(),
      school_id: values.school_id === NO_SCHOOL ? null : values.school_id,
    };
    const { error } =
      parallelModal && parallelModal !== "new"
        ? await supabase.from("parallels").update(payload).eq("id", parallelModal.id)
        : await supabase
            .from("parallels")
            .insert({ ...payload, sort_order: parallels.length + 1 });
    setSaving(false);

    if (error) {
      reportFolderError(error, "паралель", TEACHER_LIMITS.parallels);
      return;
    }
    message.success("Збережено");
    setParallelModal(null);
    void refresh();
  }

  function reportFolderError(
    error: { code?: string; message?: string },
    what: string,
    limit: number
  ) {
    if (error.code === "23505") {
      message.error(`Така ${what} вже є`);
      return;
    }
    if (error.message?.includes("Досягнуто ліміт")) {
      message.error(`Досягнуто ліміт: не більше ${limit}`);
      return;
    }
    message.error("Не вдалося зберегти");
  }

  async function removeSchool(school: School) {
    const { error } = await supabase
      .from("schools")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", school.id);
    if (error) {
      message.error("Не вдалося видалити школу");
      return;
    }
    message.success("Школу видалено. Класи залишились на місці.");
    void refresh();
  }

  async function removeParallel(parallel: Parallel) {
    const { error } = await supabase
      .from("parallels")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parallel.id);
    if (error) {
      message.error("Не вдалося видалити паралель");
      return;
    }
    message.success("Паралель видалено. Класи залишились на місці.");
    void refresh();
  }

  const schoolColumns = [
    {
      title: "Школа",
      key: "name",
      render: (_v: unknown, s: School) => <span style={{ fontWeight: 700 }}>{s.name}</span>,
    },
    {
      title: "Класів",
      key: "count",
      width: 90,
      align: "center" as const,
      render: (_v: unknown, s: School) => (
        <span style={{ fontWeight: 800 }}>{classCounts.bySchool.get(s.id) ?? 0}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_v: unknown, s: School) => (
        <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setSchoolModal(s);
              schoolForm.setFieldsValue({ name: s.name });
            }}
            style={{ borderRadius: 8 }}
          />
          <Popconfirm
            title="Видалити школу?"
            description="Класи та паралелі залишаться, просто без цієї школи."
            onConfirm={() => removeSchool(s)}
            okText="Так"
            cancelText="Ні"
          >
            <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const parallelColumns = [
    {
      title: "Паралель",
      key: "name",
      render: (_v: unknown, p: Parallel) => (
        <span style={{ fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
          {p.name}
          {p.school_id ? (
            <Tag style={{ margin: 0 }}>
              {schools.find((s) => s.id === p.school_id)?.name ?? "школа"}
            </Tag>
          ) : (
            <Tag color="default" style={{ margin: 0 }}>
              без школи
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: "Класів",
      key: "count",
      width: 90,
      align: "center" as const,
      render: (_v: unknown, p: Parallel) => (
        <span style={{ fontWeight: 800 }}>{classCounts.byParallel.get(p.id) ?? 0}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_v: unknown, p: Parallel) => (
        <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setParallelModal(p);
              parallelForm.setFieldsValue({
                name: p.name,
                school_id: p.school_id ?? NO_SCHOOL,
              });
            }}
            style={{ borderRadius: 8 }}
          />
          <Popconfirm
            title="Видалити паралель?"
            description="Класи залишаться, просто без цієї паралелі."
            onConfirm={() => removeParallel(p)}
            okText="Так"
            cancelText="Ні"
          >
            <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link href="/admin">
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
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", textTransform: "uppercase" }}>
          Школи та паралелі
        </h1>
      </div>

      <p style={{ color: "#868e96", fontWeight: 600, marginBottom: 28 }}>
        Папки необов&apos;язкові — вони лише групують класи в кабінеті. Паралель
        може існувати і без школи. Дані класів від папок не залежать.
      </p>

      <Section
        title="Школи"
        count={schools.length}
        limit={TEACHER_LIMITS.schools}
        onAdd={() => {
          setSchoolModal("new");
          schoolForm.resetFields();
        }}
      >
        <Table
          dataSource={schools}
          columns={schoolColumns}
          rowKey="id"
          pagination={false}
          size="middle"
          loading={loading}
          locale={{ emptyText: "Шкіл ще немає" }}
        />
      </Section>

      <Section
        title="Паралелі"
        count={parallels.length}
        limit={TEACHER_LIMITS.parallels}
        onAdd={() => {
          setParallelModal("new");
          parallelForm.resetFields();
          parallelForm.setFieldsValue({ school_id: NO_SCHOOL });
        }}
      >
        <Table
          dataSource={parallels}
          columns={parallelColumns}
          rowKey="id"
          pagination={false}
          size="middle"
          loading={loading}
          locale={{ emptyText: "Паралелей ще немає" }}
        />
      </Section>

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {schoolModal === "new" ? "Нова школа" : "Перейменувати школу"}
          </div>
        }
        open={schoolModal !== null}
        onOk={() => schoolForm.submit()}
        onCancel={() => setSchoolModal(null)}
        confirmLoading={saving}
        okText="Зберегти"
        cancelText="Скасувати"
        okButtonProps={{ style: { background: "#000", fontWeight: 700 } }}
      >
        <Form form={schoolForm} layout="vertical" onFinish={saveSchool} style={{ marginTop: 20 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 700 }}>Назва</span>}
            rules={[
              { required: true, message: "Введіть назву" },
              { max: 120, message: "Максимум 120 символів" },
            ]}
          >
            <Input size="large" placeholder="Ліцей №5" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {parallelModal === "new" ? "Нова паралель" : "Редагувати паралель"}
          </div>
        }
        open={parallelModal !== null}
        onOk={() => parallelForm.submit()}
        onCancel={() => setParallelModal(null)}
        confirmLoading={saving}
        okText="Зберегти"
        cancelText="Скасувати"
        okButtonProps={{ style: { background: "#000", fontWeight: 700 } }}
      >
        <Form
          form={parallelForm}
          layout="vertical"
          onFinish={saveParallel}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 700 }}>Назва</span>}
            rules={[
              { required: true, message: "Введіть назву" },
              { max: 120, message: "Максимум 120 символів" },
            ]}
          >
            <Input size="large" placeholder="7" />
          </Form.Item>

          <Form.Item
            name="school_id"
            label={<span style={{ fontWeight: 700 }}>Школа</span>}
            extra={
              <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                Паралель без школи — нормальний варіант.
              </span>
            }
          >
            <Select
              size="large"
              options={[
                { value: NO_SCHOOL, label: "— без школи" },
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function Section({
  title,
  count,
  limit,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  limit: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "3px solid #000",
        borderRadius: 16,
        boxShadow: "4px 4px 0px #000",
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase" }}>
          {title}{" "}
          <span style={{ color: "#adb5bd", fontSize: "0.85rem" }}>
            {count} / {limit}
          </span>
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAdd}
          disabled={count >= limit}
          style={{ background: "#000", borderColor: "#000", fontWeight: 800, borderRadius: 10 }}
        >
          ДОДАТИ
        </Button>
      </div>
      {children}
    </div>
  );
}
