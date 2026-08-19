"use client";

import { useState } from "react";
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from "antd";
import { UserOutlined, SmileOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import Link from "next/link";
import { ResetPinButton, ResetClassPinsButton } from "@/components/Admin/PinManager";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();
  const supabase = getSupabaseClient();

  const handleAdd = () => {
    setEditingStudent(null);
    form.resetFields();
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

  const handleFinish = async (values: any) => {
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
        setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...values } : s));
        message.success("Дані оновлено");
      } else {
        setStudents([...students, json.student].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        message.success("Учня додано");
      }
      
      setIsModalOpen(false);
      form.resetFields();
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
      title: "Повне ім’я",
      dataIndex: "full_name",
      key: "full_name",
      render: (name: string, record: Student) => (
        <div style={{ fontWeight: 700 }}>
          {name}
        </div>
      ),
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
      width: 70,
      align: "center" as const,
      render: (_value: unknown, record: Student) => (
        <ResetPinButton student={record} />
      ),
    },
    {
      title: "Дії",
      key: "actions",
      width: 150,
      align: "center" as const,
      render: (_value: unknown, record: Student) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)} 
            style={{ borderRadius: "8px" }}
          />
          <Popconfirm
            title="Видалити учня?"
            description="Це дію неможливо скасувати."
            onConfirm={() => handleDelete(record.id)}
            okText="Так"
            cancelText="Ні"
          >
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              style={{ borderRadius: "8px" }}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <Space size="large">
          <Link href={`/admin/${classId}`}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              style={{ 
                background: "#000", 
                color: "#fff", 
                border: "none", 
                height: "38px", 
                width: "38px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }} 
            />
          </Link>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.8rem", textTransform: "uppercase" }}>Список учнів</h1>
        </Space>
        
        <Space>
          <ResetClassPinsButton
            classId={classId}
            publicCode={publicCode}
            className={className}
            students={students}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size="middle"
            style={{
              background: "#000",
              borderColor: "#000",
              fontWeight: 800,
              borderRadius: "10px",
              height: "38px",
              fontSize: "0.85rem",
              boxShadow: "2px 2px 0px rgba(0,0,0,0.2)"
            }}
          >
            ДОДАТИ УЧНЯ
          </Button>
        </Space>
      </div>

      <div style={{ 
        border: "2px solid #000", 
        borderRadius: "12px", 
        overflow: "hidden",
        boxShadow: "4px 4px 0px #000"
      }}>
        <Table 
          dataSource={students} 
          columns={columns} 
          rowKey="id" 
          pagination={false}
          bordered={false}
          style={{ 
            background: "#fff"
          }}
          className="student-table"
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
        okButtonProps={{ size: "large", style: { background: "#000", fontWeight: 700 } }}
        cancelButtonProps={{ size: "large" }}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: "20px" }}>
          <Form.Item
            label={<span style={{ fontWeight: 700 }}>Повне ім’я</span>}
            name="full_name"
            rules={[{ required: true, message: "Введіть ім’я" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Олександр Петренко" size="large" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 700 }}>Нікнейм (необов’язково)</span>}
            name="nickname"
          >
            <Input prefix={<SmileOutlined />} placeholder="Сашко" size="large" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 700 }}>Емодзі (аватар)</span>}
            name="avatar_emoji"
            rules={[{ required: true, message: "Оберіть емодзі" }]}
          >
            <Input placeholder="🦁" size="large" style={{ fontSize: "1.5rem" }} />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx global>{`
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
