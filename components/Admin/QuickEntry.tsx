"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Form, Select, InputNumber, message, Tooltip, Radio } from "antd";
import { StarFilled } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import EntryNoteField from "@/components/Admin/EntryNoteField";
import {
  entryTypeLabel,
  loadClassGroups,
  loadEntryTypes,
  signedAmount,
  type ClassGroup,
  type EntryType,
} from "@/lib/admin/classConfig";

/**
 * Нарахування поза журналом: учню, групі або всьому класу.
 *
 * Замінює QuickBonusPenalty з двома зашитими кнопками «Бонус»/«Штраф».
 * Тепер список типів приходить із класу (entry_types), знак і значення за
 * замовчуванням підставляє сам тип, а «кому» включає ГРУПУ.
 *
 * Fan-out по групі робить сервер (/api/admin/entry): склад групи не можна
 * брати з клієнта, інакше свій же учень з іншої групи проліз би тихо.
 */

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id?: string | null;
}

type TargetKind = "student" | "group" | "class";

export default function QuickEntry({
  classId,
  students,
  onSuccess,
}: {
  classId: string;
  students: Student[];
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [entryTypes, setEntryTypes] = useState<EntryType[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [form] = Form.useForm();

  const supabase = getSupabaseClient();

  // Конфігурацію тягнемо при відкритті, а не при монтуванні: тулбар живе на
  // кожній сторінці класу, і два зайві запити на кожен рендер журналу
  // нікому не потрібні.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setConfigLoading(true);
    Promise.all([loadEntryTypes(supabase, classId), loadClassGroups(supabase, classId)])
      .then(([types, grps]) => {
        if (cancelled) return;
        setEntryTypes(types);
        setGroups(grps);
        const firstNonLesson = types.find((t) => !t.is_lesson_bound) ?? types[0];
        if (firstNonLesson) {
          form.setFieldsValue({
            entry_type_id: firstNonLesson.id,
            amount: firstNonLesson.default_amount,
          });
        }
      })
      .catch(() => message.error("Не вдалося завантажити типи нарахувань"))
      .finally(() => !cancelled && setConfigLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, classId, supabase, form]);

  const groupSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    students.forEach((s) => {
      if (!s.group_id) return;
      sizes.set(s.group_id, (sizes.get(s.group_id) ?? 0) + 1);
    });
    return sizes;
  }, [students]);

  const openModal = () => {
    form.resetFields();
    form.setFieldsValue({ target: "student" as TargetKind, amount: 1 });
    setIsOpen(true);
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    const type = entryTypes.find((t) => t.id === values.entry_type_id);
    if (!type) {
      message.error("Оберіть тип нарахування");
      return;
    }

    const kind = values.target as TargetKind;
    const target =
      kind === "student"
        ? { kind, student_id: values.studentId as string }
        : kind === "group"
        ? { kind, group_id: values.groupId as string }
        : { kind };

    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          entry_type_id: type.id,
          // Знак бере тип: вчитель вводить «скільки», а не «плюс чи мінус».
          amount: signedAmount(type, Number(values.amount)),
          note: (values.note as string | undefined) ?? null,
          target,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка збереження");

      message.success(
        json.count > 1 ? `Нараховано ${json.count} учням` : "Нарахування збережено"
      );
      setIsOpen(false);
      form.resetFields();
      onSuccess?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Помилка збереження");
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = entryTypes.map((t) => ({
    value: t.id,
    label: `${entryTypeLabel(t)} · ${t.sign > 0 ? "+" : "−"}`,
  }));

  return (
    <>
      <Tooltip title="НАРАХУВАННЯ">
        <Button
          onClick={openModal}
          size="middle"
          icon={<StarFilled />}
          style={{
            background: "#fff9db",
            color: "var(--color-star, #f59f00)",
            border: "2px solid var(--color-star, #f59f00)",
            fontWeight: 800,
            borderRadius: "12px",
            height: "42px",
            width: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            boxShadow: "3px 3px 0px #2f9e44",
          }}
        />
      </Tooltip>

      <Modal
        title={<div style={{ fontWeight: 900, textTransform: "uppercase" }}>Нарахування</div>}
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        footer={[
          <Button key="back" onClick={() => setIsOpen(false)} size="middle">
            Скасувати
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => form.submit()}
            loading={loading}
            disabled={configLoading || entryTypes.length === 0}
            size="middle"
            style={{ fontWeight: 700, background: "#000" }}
          >
            Зберегти
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: "24px" }}>
          <Form.Item
            name="entry_type_id"
            label={<span style={{ fontWeight: 700 }}>Тип нарахування</span>}
            rules={[{ required: true, message: "Оберіть тип" }]}
          >
            <Select
              size="middle"
              loading={configLoading}
              options={typeOptions}
              placeholder="Оберіть тип"
              onChange={(id) => {
                const t = entryTypes.find((x) => x.id === id);
                if (t) form.setFieldsValue({ amount: t.default_amount });
              }}
            />
          </Form.Item>

          <Form.Item
            name="target"
            label={<span style={{ fontWeight: 700 }}>Кому призначити?</span>}
            initialValue="student"
          >
            <Radio.Group
              options={[
                { value: "student", label: "Учню" },
                { value: "group", label: "Групі", disabled: groups.length === 0 },
                { value: "class", label: "Усьому класу" },
              ]}
              optionType="button"
              buttonStyle="solid"
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.target !== curr.target}>
            {({ getFieldValue }) => {
              const kind = getFieldValue("target") as TargetKind;

              if (kind === "student") {
                return (
                  <Form.Item
                    name="studentId"
                    label={<span style={{ fontWeight: 700 }}>Учень</span>}
                    rules={[{ required: true, message: "Оберіть учня" }]}
                  >
                    <Select
                      size="middle"
                      showSearch
                      placeholder="Пошук за прізвищем..."
                      optionFilterProp="label"
                      options={students.map((s) => ({
                        value: s.id,
                        label: `${s.avatar_emoji} ${s.full_name}${s.nickname ? ` (${s.nickname})` : ""}`,
                      }))}
                    />
                  </Form.Item>
                );
              }

              if (kind === "group") {
                return (
                  <Form.Item
                    name="groupId"
                    label={<span style={{ fontWeight: 700 }}>Група</span>}
                    rules={[{ required: true, message: "Оберіть групу" }]}
                    extra={
                      <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                        Кожен учасник отримає окреме нарахування, операцію можна
                        скасувати цілком в історії.
                      </span>
                    }
                  >
                    <Select
                      size="middle"
                      placeholder="Оберіть групу"
                      options={groups.map((g) => ({
                        value: g.id,
                        label: `${g.name} · ${groupSizes.get(g.id) ?? 0} учнів`,
                        disabled: (groupSizes.get(g.id) ?? 0) === 0,
                      }))}
                    />
                  </Form.Item>
                );
              }

              return null;
            }}
          </Form.Item>

          <Form.Item
            name="amount"
            label={<span style={{ fontWeight: 700 }}>Скільки зірок</span>}
            rules={[{ required: true, message: "Вкажіть кількість" }]}
            extra={
              <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                Знак («+» чи «−») визначає сам тип нарахування.
              </span>
            }
          >
            <InputNumber min={1} max={100} size="middle" addonAfter="⭐" style={{ width: "100%" }} />
          </Form.Item>

          <EntryNoteField />
        </Form>
      </Modal>
    </>
  );
}
