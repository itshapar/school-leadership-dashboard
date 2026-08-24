"use client";

import { useMemo, useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Table, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import { CLASS_LIMITS, removeClassGroup, type ClassGroup } from "@/lib/admin/classConfig";

/**
 * Групи всередині класу (міграція 014): CRUD + розподіл учнів.
 *
 * Учень належить щонайбільше ОДНІЙ групі свого класу — це не політика UI,
 * а форма даних: students.group_id — скалярний стовпець із композитним FK
 * (group_id, class_id) → class_groups(id, class_id).
 *
 * Призначення групи йде через /api/admin/student (PATCH), а не прямим
 * записом: там уже живе валідація учня і часткове оновлення полів.
 */

interface StudentRow {
  id: string;
  full_name: string;
  avatar_emoji: string;
  group_id: string | null;
}

interface Props {
  classId: string;
  groups: ClassGroup[];
  students: StudentRow[];
  onChanged: () => void;
}

const NO_GROUP = "__none__";

export default function GroupsPanel({ classId, groups, students, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [form] = Form.useForm<{ name: string }>();
  const supabase = getSupabaseClient();

  const atLimit = groups.length >= CLASS_LIMITS.groups;

  const sizes = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (!s.group_id) return;
      map.set(s.group_id, (map.get(s.group_id) ?? 0) + 1);
    });
    return map;
  }, [students]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (group: ClassGroup) => {
    setEditing(group);
    form.setFieldsValue({ name: group.name });
    setOpen(true);
  };

  const onFinish = async (values: { name: string }) => {
    setSaving(true);
    const payload = { name: values.name.trim() };

    const { error } = editing
      ? await supabase.from("class_groups").update(payload).eq("id", editing.id)
      : await supabase
          .from("class_groups")
          .insert({ ...payload, class_id: classId, sort_order: groups.length + 1 });

    setSaving(false);

    if (error) {
      const duplicate = error.code === "23505";
      const limitHit = error.message?.includes("Досягнуто ліміт");
      message.error(
        duplicate
          ? "Група з такою назвою вже є"
          : limitHit
          ? `Досягнуто ліміт: не більше ${CLASS_LIMITS.groups} груп на клас`
          : "Не вдалося зберегти групу"
      );
      return;
    }

    message.success(editing ? "Групу оновлено" : "Групу створено");
    setOpen(false);
    onChanged();
  };

  const onDelete = async (group: ClassGroup) => {
    const { error } = await removeClassGroup(supabase, group.id);
    if (error) {
      message.error("Не вдалося видалити групу");
      return;
    }
    message.success("Групу видалено. Учні залишились у класі.");
    onChanged();
  };

  const assign = async (studentId: string, groupId: string) => {
    setAssigning(studentId);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/student", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: studentId,
          group_id: groupId === NO_GROUP ? null : groupId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка");
      onChanged();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Не вдалося змінити групу");
    } finally {
      setAssigning(null);
    }
  };

  const groupColumns = [
    {
      title: "Група",
      key: "name",
      render: (_v: unknown, g: ClassGroup) => (
        <span style={{ fontWeight: 700 }}>{g.name}</span>
      ),
    },
    {
      title: "Учнів",
      key: "size",
      width: 100,
      align: "center" as const,
      render: (_v: unknown, g: ClassGroup) => (
        <span style={{ fontWeight: 800 }}>{sizes.get(g.id) ?? 0}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_v: unknown, g: ClassGroup) => (
        <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button icon={<EditOutlined />} onClick={() => openEdit(g)} style={{ borderRadius: 8 }} />
          <Popconfirm
            title="Видалити групу?"
            description="Учні залишаться в класі, просто без групи."
            onConfirm={() => onDelete(g)}
            okText="Так"
            cancelText="Ні"
          >
            <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const studentColumns = [
    {
      title: "Учень",
      key: "student",
      render: (_v: unknown, s: StudentRow) => (
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <span style={{ fontSize: "1.3rem" }}>{s.avatar_emoji}</span>
          {s.full_name}
        </span>
      ),
    },
    {
      title: "Група",
      key: "group",
      width: 220,
      render: (_v: unknown, s: StudentRow) => (
        <Select
          size="middle"
          style={{ width: "100%" }}
          value={s.group_id ?? NO_GROUP}
          loading={assigning === s.id}
          onChange={(v) => assign(s.id, v)}
          options={[
            { value: NO_GROUP, label: "Без групи" },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      ),
    },
  ];

  return (
    <div>
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
        <span style={{ color: "#868e96", fontSize: "0.85rem", fontWeight: 700 }}>
          Учень може бути щонайбільше в одній групі · {groups.length} /{" "}
          {CLASS_LIMITS.groups}
        </span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          disabled={atLimit}
          style={{ background: "#000", borderColor: "#000", fontWeight: 800, borderRadius: 10 }}
        >
          ДОДАТИ ГРУПУ
        </Button>
      </div>

      <Table
        dataSource={groups}
        columns={groupColumns}
        rowKey="id"
        pagination={false}
        size="middle"
        locale={{ emptyText: "Груп ще немає" }}
        style={{ marginBottom: 32 }}
      />

      {groups.length > 0 && (
        <>
          <h3
            style={{
              fontSize: "0.9rem",
              fontWeight: 900,
              textTransform: "uppercase",
              color: "#868e96",
              marginBottom: 12,
            }}
          >
            Розподіл учнів
          </h3>
          <Table
            dataSource={students}
            columns={studentColumns}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: "У класі ще немає учнів" }}
          />
        </>
      )}

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {editing ? "Перейменувати групу" : "Нова група"}
          </div>
        }
        open={open}
        onOk={() => form.submit()}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        okText="Зберегти"
        cancelText="Скасувати"
        okButtonProps={{ style: { background: "#000", fontWeight: 700 } }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 20 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 700 }}>Назва групи</span>}
            rules={[
              { required: true, message: "Введіть назву" },
              { max: 80, message: "Максимум 80 символів" },
            ]}
          >
            <Input size="large" placeholder="Наприклад: Група А" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
