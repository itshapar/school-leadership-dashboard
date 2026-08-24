"use client";

import { useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Table, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  CLASS_LIMITS,
  removeClassPrize,
  removeIndividualPrize,
  type ClassPrize,
  type IndividualPrize,
} from "@/lib/admin/classConfig";

/**
 * Нагороди класу — і індивідуальні, і класові, одним компонентом.
 *
 * Класові нагороди (class_prizes, міграція 016) замінюють два зашиті стовпці
 * classes.game_day_threshold / pizza_day_threshold. Різниця між двома видами
 * лише в тому, з чим порівнюється поріг:
 *   • індивідуальний — із сумою зірок ОДНОГО учня (stars_required);
 *   • класовий       — із сумою зірок УСЬОГО класу (threshold).
 * Форма й CRUD ідентичні, тому компонент один із параметром `kind`.
 */

type Kind = "individual" | "class";

interface FormValues {
  name: string;
  emoji: string;
  threshold: number;
}

interface Props {
  classId: string;
  kind: Kind;
  individualPrizes?: IndividualPrize[];
  classPrizes?: ClassPrize[];
  onChanged: () => void;
}

interface Row {
  id: string;
  name: string;
  emoji: string;
  threshold: number;
}

export default function PrizesPanel({
  classId,
  kind,
  individualPrizes = [],
  classPrizes = [],
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const supabase = getSupabaseClient();

  const isIndividual = kind === "individual";
  const table = isIndividual ? "prizes_individual" : "class_prizes";
  const thresholdColumn = isIndividual ? "stars_required" : "threshold";
  const limit = isIndividual ? CLASS_LIMITS.individualPrizes : CLASS_LIMITS.classPrizes;

  const rows: Row[] = isIndividual
    ? individualPrizes.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        threshold: p.stars_required,
      }))
    : classPrizes.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        threshold: p.threshold,
      }));

  const atLimit = rows.length >= limit;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ emoji: isIndividual ? "🎁" : "🏆", threshold: isIndividual ? 10 : 250 });
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    form.setFieldsValue({ name: row.name, emoji: row.emoji, threshold: row.threshold });
    setOpen(true);
  };

  const onFinish = async (values: FormValues) => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      emoji: values.emoji.trim() || (isIndividual ? "🎁" : "🏆"),
      [thresholdColumn]: values.threshold,
    };

    const { error } = editing
      ? await supabase.from(table).update(payload).eq("id", editing.id)
      : await supabase
          .from(table)
          .insert({ ...payload, class_id: classId, sort_order: rows.length + 1 });

    setSaving(false);

    if (error) {
      const duplicate = error.code === "23505";
      const limitHit = error.message?.includes("Досягнуто ліміт");
      message.error(
        duplicate
          ? "Нагорода з такою назвою вже є в класі"
          : limitHit
          ? `Досягнуто ліміт: не більше ${limit} нагород на клас`
          : "Не вдалося зберегти нагороду"
      );
      return;
    }

    message.success(editing ? "Нагороду оновлено" : "Нагороду додано");
    setOpen(false);
    onChanged();
  };

  const onDelete = async (row: Row) => {
    const { softDeleted, error } = isIndividual
      ? await removeIndividualPrize(supabase, row.id)
      : await removeClassPrize(supabase, row.id);

    if (error) {
      message.error("Не вдалося видалити нагороду");
      return;
    }
    message.success(
      softDeleted ? "Нагороду сховано. Історія видач збережена." : "Нагороду видалено"
    );
    onChanged();
  };

  const columns = [
    {
      title: "Нагорода",
      key: "name",
      render: (_v: unknown, row: Row) => (
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <span style={{ fontSize: "1.3rem" }}>{row.emoji}</span>
          {row.name}
        </span>
      ),
    },
    {
      title: "Кількість зірок",
      dataIndex: "threshold",
      key: "threshold",
      width: 160,
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 900 }}>{v} ⭐</span>,
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_v: unknown, row: Row) => (
        <span style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)} style={{ borderRadius: 8, border: "2px solid #000" }} />
          <Popconfirm
            title="Видалити нагороду?"
            description="Якщо нагороду вже видавали, її буде сховано, а історія збережеться."
            onConfirm={() => onDelete(row)}
            okText="Так"
            cancelText="Ні"
          >
            <Button danger icon={<DeleteOutlined />} className="btn-danger-outline" style={{ padding: "4px 12px" }} />
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
        }}
      >
        {/* flex:1 + minWidth:0 (живий фідбек): текст тут довший для класових
            нагород, ніж для індивідуальних — без цього довший варіант не
            вміщався в рядок і виштовхував кнопку на новий рядок, тоді як
            коротший лишався в один рядок. Тепер довгий текст переноситься
            сам, а кнопка (flexShrink:0) завжди лишається праворуч. */}
        <span style={{ color: "#868e96", fontSize: "0.85rem", fontWeight: 700, flex: "1 1 auto", minWidth: 0 }}>
          {isIndividual
            ? "Учень отримує нагороду, коли набирає потрібну кількість власних зірок"
            : "Нагороду отримує весь клас, коли зірки класу сягають потрібної кількості"}
        </span>
        <Button
          type="primary"
          onClick={openCreate}
          disabled={atLimit}
          className="btn-primary"
          style={{ flexShrink: 0 }}
        >
          ДОДАТИ НАГОРОДУ
        </Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="middle"
        locale={{ emptyText: "Нагород ще немає" }}
      />

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {editing ? "Редагувати нагороду" : "Нова нагорода"}
          </div>
        }
        open={open}
        onOk={() => form.submit()}
        onCancel={() => setOpen(false)}
        confirmLoading={saving}
        okText="Зберегти"
        cancelText="Скасувати"
        okButtonProps={{ className: "btn-primary" }}
        cancelButtonProps={{ className: "btn-secondary" }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 20 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 700 }}>Назва</span>}
            rules={[
              { required: true, message: "Введіть назву" },
              { max: 80, message: "Максимум 80 символів" },
            ]}
          >
            <Input size="large" placeholder={isIndividual ? "Кіндер" : "Pizza day"} />
          </Form.Item>

          <Form.Item
            name="emoji"
            label={<span style={{ fontWeight: 700 }}>Емодзі</span>}
            rules={[{ max: 16, message: "Занадто довго" }]}
          >
            <Input size="large" style={{ fontSize: "1.4rem", width: 120 }} />
          </Form.Item>

          <Form.Item
            name="threshold"
            label={
              <span style={{ fontWeight: 700 }}>
                {isIndividual ? "Скільки зірок потрібно учню" : "Скільки зірок потрібно класу"}
              </span>
            }
            rules={[{ required: true, message: "Вкажіть поріг" }]}
          >
            <InputNumber min={1} max={100000} size="large" addonAfter="⭐" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
