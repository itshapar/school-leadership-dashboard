"use client";

import { useEffect, useMemo, useState } from "react";
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from "antd";
import { Eye, EyeSlash, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import { ResetPinButton, PrintClassPinsButton, RegenerateClassPinsButton } from "@/components/Admin/PinManager";
import {
  FULL_NAME_COMBINED_HINT,
  FULL_NAME_LABEL,
  FULL_NAME_PLACEHOLDER,
  checkNameOrder,
  fullNameRule,
} from "@/lib/students/fullName";
import BackButton from "@/components/BackButton";

/**
 * Список учнів класу.
 *
 * Етап 5: поле ПІБ називається «Прізвище та ім'я», обов'язкове, з валідацією
 * «щонайменше два слова» і м'якою перевіркою порядку прямо у формі.
 * Порядок критичний: публічна сторінка показує ДРУГЕ слово (див.
 * lib/students/fullName.ts).
 *
 * Групи (Етап 6) прибрано з інтерфейсу (9.8, живий фідбек) — функція ще не
 * готова для показу; group_id лишається в даних, просто нічого його не
 * редагує звідси.
 */

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

export default function StudentManager({
  classId,
  initialStudents,
  publicCode = "",
  className = "",
}: {
  classId: string;
  initialStudents: Student[];
  publicCode?: string;
  className?: string;
}) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [pins, setPins] = useState<Record<string, string>>({});
  const [pinsVisible, setPinsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();
  const supabase = getSupabaseClient();

  const watchedName = Form.useWatch("full_name", form) as string | undefined;
  const orderWarning = useMemo(() => checkNameOrder(watchedName), [watchedName]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("get_class_pins", { p_class_id: classId })
      .then(
        ({
          data,
          error,
        }: {
          data: Array<{ student_id: string; pin: string }> | null;
          error: { message: string } | null;
        }) => {
          if (cancelled) return;
          if (error) {
            console.error("get_class_pins:", error);
            message.error("Не вдалося завантажити PIN-и");
            return;
          }
          setPins(Object.fromEntries((data ?? []).map((r) => [r.student_id, r.pin])));
        }
      );
    return () => {
      cancelled = true;
    };
  }, [classId, supabase]);

  function mergePins(next: Record<string, string>) {
    setPins((prev) => ({ ...prev, ...next }));
  }

  const handleAdd = () => {
    setEditingStudent(null);
    form.resetFields();
    form.setFieldsValue({ avatar_emoji: "👤" });
    setIsModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.setFieldsValue({
      full_name: student.full_name,
      nickname: student.nickname,
      avatar_emoji: student.avatar_emoji,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await adminApiFetch(supabase, `/api/admin/student?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Помилка при видаленні");

      setStudents(students.filter((s) => s.id !== id));
      message.success("Учня видалено");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Помилка при видаленні");
    }
  };

  const handleFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const method = editingStudent ? "PATCH" : "POST";
      const payload = editingStudent
        ? { id: editingStudent.id, ...values }
        : { ...values, class_id: classId };

      const res = await adminApiFetch(supabase, "/api/admin/student", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Помилка збереження");

      if (editingStudent) {
        setStudents(
          students.map((s) =>
            s.id === editingStudent.id ? { ...s, ...(values as Partial<Student>) } : s
          )
        );
        message.success("Дані оновлено");
      } else {
        setStudents(
          [...students, json.student].sort((a, b) =>
            a.full_name.localeCompare(b.full_name, "uk-UA")
          )
        );
        message.success("Учня додано");
      }

      setIsModalOpen(false);
      form.resetFields();
      router.refresh();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Помилка збереження");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Аватар",
      dataIndex: "avatar_emoji",
      key: "avatar_emoji",
      width: 80,
      align: "center" as const,
      render: (emoji: string) => <span style={{ fontSize: "1.5rem" }}>{emoji}</span>,
    },
    {
      title: FULL_NAME_LABEL,
      dataIndex: "full_name",
      key: "full_name",
      render: (name: string) => <div style={{ fontWeight: 600 }}>{name}</div>,
    },
    {
      title: "Нікнейм",
      dataIndex: "nickname",
      key: "nickname",
      render: (nick: string) => nick || <span style={{ color: "#adb5bd" }}>—</span>,
    },
    {
      title: "PIN",
      key: "pin",
      width: 130,
      align: "center" as const,
      render: (_value: unknown, record: Student) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: pins[record.id] ? "var(--color-text)" : "#adb5bd",
            }}
          >
            {pins[record.id] ? (pinsVisible ? pins[record.id] : "••••") : "—"}
          </span>
          <ResetPinButton
            student={record}
            onReset={(pin) => mergePins({ [record.id]: pin })}
          />
        </div>
      ),
    },
    {
      title: "Дії",
      key: "actions",
      width: 130,
      align: "center" as const,
      render: (_value: unknown, record: Student) => (
        <Space>
          <Button
            icon={<PencilSimple />}
            onClick={() => handleEdit(record)}
            style={{ borderRadius: "8px", border: "2px solid #000" }}
          />
          <Popconfirm
            title="Видалити учня?"
            description="Це дію неможливо скасувати."
            onConfirm={() => handleDelete(record.id)}
            okText="Так"
            cancelText="Ні"
          >
            <Button danger icon={<Trash />} className="btn-danger-outline" style={{ padding: "4px 12px" }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: 12, flexWrap: "wrap" }}>
        <Space size="large">
          <BackButton href={`/admin/${publicCode || classId}`} label="Назад до журналу" />
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.8rem", textTransform: "uppercase" }}>
            Список учнів
          </h1>
        </Space>

        <Space wrap>
          <Button
            icon={pinsVisible ? <EyeSlash /> : <Eye />}
            onClick={() => setPinsVisible((v) => !v)}
            className="btn-secondary"
            style={{
              height: "38px",
              // Фіксована ширина (замість auto): "ПОКАЗАТИ PIN-И" і
              // "СХОВАТИ PIN-И" мають різну довжину, без цього кнопка
              // смикалась при кожному перемиканні (9.11, живий фідбек).
              width: "188px",
            }}
          >
            {pinsVisible ? "СХОВАТИ PIN-И" : "ПОКАЗАТИ PIN-И"}
          </Button>
          <PrintClassPinsButton
            classId={classId}
            publicCode={publicCode}
            className={className}
            students={students}
          />
          <RegenerateClassPinsButton
            classId={classId}
            publicCode={publicCode}
            className={className}
            students={students}
            onReset={mergePins}
          />
          <Button type="primary" icon={<Plus />} onClick={handleAdd} className="btn-primary" style={{ height: "38px" }}>
            ДОДАТИ УЧНЯ
          </Button>
        </Space>
      </div>

      {/* Неблокуюче нагадування про запевнення з розділу 5 Умов (Етап 5). */}

      <div
        style={{
          border: "2px solid #000",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "4px 4px 0px #000",
        }}
      >
        <Table
          dataSource={students}
          columns={columns}
          rowKey="id"
          pagination={false}
          bordered={false}
          style={{ background: "#fff" }}
          className="student-table"
          locale={{ emptyText: "У класі ще немає учнів" }}
        />
      </div>

      <Modal
        title={
          <div style={{ fontWeight: 900, textTransform: "uppercase" }}>
            {editingStudent ? "Редагувати учня" : "Додати учня"}
          </div>
        }
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        okText="Зберегти"
        cancelText="Скасувати"
        confirmLoading={loading}
        okButtonProps={{ className: "btn-primary" }}
        cancelButtonProps={{ className: "btn-secondary" }}
      >
        {/* Підказки під полями (Form.Item extra) щільно тиснулись до
            наступного поля (живий фідбек) — розсуваємо самі поля, а не
            додаємо відступ кожній підказці окремо. */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          style={{ marginTop: "20px" }}
          className="student-form"
        >
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{FULL_NAME_LABEL}</span>}
            name="full_name"
            rules={[fullNameRule]}
            extra={
              <span style={{ color: "#868e96", fontSize: "0.8rem", display: "block", lineHeight: 1.55 }}>
                {FULL_NAME_COMBINED_HINT}
              </span>
            }
            validateStatus={orderWarning.suspicious ? "warning" : undefined}
            help={
              orderWarning.suspicious ? (
                <span style={{ color: "#f08c00", fontWeight: 600 }}>
                  {orderWarning.reason}. Публічна сторінка показує друге слово,
                  перевірте порядок.
                </span>
              ) : undefined
            }
          >
            <Input placeholder={FULL_NAME_PLACEHOLDER} size="large" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600 }}>Нікнейм (необов&apos;язково)</span>}
            name="nickname"
            extra={
              <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                Якщо заданий, саме він показується публічно замість імені.
              </span>
            }
          >
            <Input placeholder="Сашко" size="large" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600 }}>Емодзі (аватар)</span>}
            name="avatar_emoji"
            rules={[{ required: true, message: "Оберіть емодзі" }]}
          >
            <Input placeholder="🦁" size="large" style={{ fontSize: "1.5rem", width: 120 }} />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
        .student-form .ant-form-item {
          margin-bottom: 28px;
        }
        .student-form .ant-form-item-extra {
          margin-top: 6px;
        }
        .student-table .ant-table-thead > tr > th {
          background: #f8f9fa !important;
          font-weight: 900 !important;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
}
