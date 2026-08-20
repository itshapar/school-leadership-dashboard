"use client";

import { useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  CLASS_LIMITS,
  removeEntryType,
  type EntryType,
} from "@/lib/admin/classConfig";
import ColorSwatches from "@/components/Admin/ClassSettings/ColorSwatches";

/**
 * Типи нарахувань класу — заміна зашитим lesson/bonus/penalty.
 *
 * Запис іде напряму в таблицю під RLS: 4 політики з WITH CHECK (міграція 015)
 * гарантують, що вчитель бачить і змінює лише свої класи. Окремий API-маршрут
 * тут не додав би жодної перевірки — лише ще один шар, який може розійтися
 * з політиками.
 */

interface Props {
  classId: string;
  types: EntryType[];
  onChanged: () => void;
}

interface FormValues {
  name: string;
  sign: 1 | -1;
  default_amount: number;
  is_lesson_bound: boolean;
  icon?: string;
  color?: string | null;
}

export default function EntryTypesPanel({ classId, types, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EntryType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const supabase = getSupabaseClient();

  const atLimit = types.length >= CLASS_LIMITS.entryTypes;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      sign: 1,
      default_amount: 1,
      is_lesson_bound: false,
      icon: "⭐",
      color: null,
    });
    setOpen(true);
  };

  const openEdit = (type: EntryType) => {
    setEditing(type);
    form.setFieldsValue({
      name: type.name,
      sign: type.sign,
      default_amount: type.default_amount,
      is_lesson_bound: type.is_lesson_bound,
      icon: type.icon ?? "",
      color: type.color,
    });
    setOpen(true);
  };

  const onFinish = async (values: FormValues) => {
    setSaving(true);
    const payload = {
      name: values.name.trim(),
      sign: values.sign,
      default_amount: values.default_amount,
      is_lesson_bound: values.is_lesson_bound,
      icon: values.icon?.trim() || null,
      color: values.color ?? null,
    };

    const { error } = editing
      ? await supabase.from("entry_types").update(payload).eq("id", editing.id)
      : await supabase.from("entry_types").insert({
          ...payload,
          class_id: classId,
          sort_order: types.length + 1,
        });

    setSaving(false);

    if (error) {
      // Унікальність назви і ліміт 30 приходять із БД — показуємо причину.
      const duplicate = error.code === "23505";
      const limit = error.message?.includes("Досягнуто ліміт");
      message.error(
        duplicate
          ? "Тип із такою назвою вже є в класі"
          : limit
          ? `Досягнуто ліміт: не більше ${CLASS_LIMITS.entryTypes} типів на клас`
          : "Не вдалося зберегти тип"
      );
      return;
    }

    message.success(editing ? "Тип оновлено" : "Тип додано");
    setOpen(false);
    onChanged();
  };

  const onDelete = async (type: EntryType) => {
    const { softDeleted, error } = await removeEntryType(supabase, type.id);
    if (error) {
      message.error("Не вдалося видалити тип");
      return;
    }
    message.success(
      softDeleted
        ? "Тип сховано. Наявні нарахування залишаються в історії."
        : "Тип видалено"
    );
    onChanged();
  };

  const columns = [
    {
      title: "Тип",
      key: "name",
      render: (_v: unknown, t: EntryType) => (
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <span style={{ fontSize: "1.3rem" }}>{t.icon ?? "•"}</span>
          <span style={t.color ? { color: t.color } : undefined}>{t.name}</span>
        </span>
      ),
    },
    {
      title: "Знак",
      key: "sign",
      width: 90,
      align: "center" as const,
      render: (_v: unknown, t: EntryType) => (
        <Tag color={t.sign > 0 ? "green" : "red"} style={{ fontWeight: 900, margin: 0 }}>
          {t.sign > 0 ? "+" : "−"}
        </Tag>
      ),
    },
    {
      title: "За замовч.",
      dataIndex: "default_amount",
      key: "default_amount",
      width: 110,
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 800 }}>{v} ⭐</span>,
    },
    {
      title: "До уроку",
      key: "is_lesson_bound",
      width: 120,
      align: "center" as const,
      render: (_v: unknown, t: EntryType) =>
        t.is_lesson_bound ? (
          <Tag color="blue" style={{ fontWeight: 700, margin: 0 }}>
            у журналі
          </Tag>
        ) : (
          <span style={{ color: "#adb5bd" }}>—</span>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_v: unknown, t: EntryType) => (
        <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button icon={<EditOutlined />} onClick={() => openEdit(t)} style={{ borderRadius: 8 }} />
          <Popconfirm
            title="Видалити тип?"
            description="Якщо за ним уже є нарахування, тип буде сховано, а історія збережеться."
            onConfirm={() => onDelete(t)}
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
          {types.length} / {CLASS_LIMITS.entryTypes} типів
        </span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          disabled={atLimit}
          style={{ background: "#000", borderColor: "#000", fontWeight: 800, borderRadius: 10 }}
        >
          ДОДАТИ ТИП
        </Button>
      </div>

      <Table
        dataSource={types}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="middle"
        locale={{ emptyText: "Типів ще немає" }}
      />

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {editing ? "Редагувати тип" : "Новий тип нарахування"}
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
            label={<span style={{ fontWeight: 700 }}>Назва</span>}
            rules={[
              { required: true, message: "Введіть назву" },
              { max: 60, message: "Максимум 60 символів" },
            ]}
          >
            <Input size="large" placeholder="Наприклад: Домашнє завдання" />
          </Form.Item>

          <Form.Item name="sign" label={<span style={{ fontWeight: 700 }}>Знак</span>}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 1, label: "＋ Нарахування" },
                { value: -1, label: "－ Списання" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="default_amount"
            label={<span style={{ fontWeight: 700 }}>Значення за замовчуванням</span>}
            rules={[{ required: true, message: "Вкажіть значення" }]}
          >
            <InputNumber min={1} max={100} size="large" addonAfter="⭐" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="is_lesson_bound"
            label={<span style={{ fontWeight: 700 }}>Прив&apos;язаний до уроку</span>}
            valuePropName="checked"
            extra={
              <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                Такий тип заповнює клітинки журналу «учень × урок». Журнал
                використовує перший із них.
              </span>
            }
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="icon"
            label={<span style={{ fontWeight: 700 }}>Іконка (емодзі)</span>}
            rules={[{ max: 16, message: "Занадто довго" }]}
          >
            <Input size="large" placeholder="⭐" style={{ fontSize: "1.4rem", width: 120 }} />
          </Form.Item>

          <Form.Item name="color" label={<span style={{ fontWeight: 700 }}>Колір</span>}>
            <ColorSwatches />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
