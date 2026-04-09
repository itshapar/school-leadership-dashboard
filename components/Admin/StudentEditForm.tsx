"use client";

import { useState } from "react";
import { Form, Input, Button, message, Space, Card } from "antd";
import { UserOutlined, SmileOutlined, SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export default function StudentEditForm({
  student,
  classId,
}: {
  student: Student;
  classId: string;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await adminApiFetch(supabase, "/api/admin/student", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student.id,
          ...values,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Помилка оновлення");

      message.success("Дані учня оновлено");
      router.refresh();
      router.push(`/admin/${classId}`);
    } catch (err: unknown) {
      console.error(err);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "0 20px" }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => router.back()}
        style={{ marginBottom: "20px", fontWeight: 700 }}
      >
        Назад
      </Button>

      <Card 
        title={<div style={{ fontWeight: 900, fontSize: "1.2rem", textTransform: "uppercase" }}>Редагувати учня</div>}
        style={{ border: "3px solid #000", boxShadow: "4px 4px 0px #000" }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            full_name: student.full_name,
            nickname: student.nickname,
            avatar_emoji: student.avatar_emoji,
          }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            label={<span style={{ fontWeight: 800 }}>Повне ім’я</span>}
            name="full_name"
            rules={[{ required: true, message: "Введіть повне ім’я" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Наприклад: Олександр Петренко" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 800 }}>Нікнейм (необов’язково)</span>}
            name="nickname"
          >
            <Input prefix={<SmileOutlined />} placeholder="Наприклад: Сашко" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 800 }}>Емодзі (аватар)</span>}
            name="avatar_emoji"
            rules={[{ required: true, message: "Оберіть емодзі" }]}
          >
            <Input placeholder="Наприклад: 🦁" style={{ fontSize: "1.5rem" }} />
          </Form.Item>

          <Form.Item style={{ marginTop: "32px", marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
              style={{
                width: "100%",
                height: "50px",
                fontWeight: 900,
                background: "#000",
                borderColor: "#000",
                fontSize: "1.1rem",
                borderRadius: "10px"
              }}
            >
              ЗБЕРЕГТИ ЗМІНИ
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
