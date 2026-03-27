"use client";

import { useState, useEffect } from "react";
import { Form, Select, InputNumber, Input, Button, Alert, message, Radio } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export default function AddBonusPage() {
  const params = useParams();
  const classId = params.classId as string;
  const [students, setStudents] = useState<Student[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
      if (cls) setClassName(cls.name);
      const { data } = await supabase
        .from("students")
        .select("id, full_name, nickname, avatar_emoji")
        .eq("class_id", classId)
        .order("full_name");
      setStudents(data ?? []);
    }
    load();
  }, [classId]);

  async function onFinish(values: {
    entryType: "bonus" | "penalty";
    target: "student" | "class";
    studentId?: string;
    amount: number;
    note?: string;
  }) {
    setLoading(true);
    setSuccess(false);
    const supabase = getSupabaseClient();

    const amount = values.entryType === "penalty" ? -Math.abs(values.amount) : Math.abs(values.amount);
    const entry = {
      class_id: classId,
      student_id: values.target === "class" ? null : values.studentId,
      type: values.entryType,
      amount,
      note: values.note || null,
    };

    const { error } = await supabase.from("star_entries").insert(entry);
    if (error) {
      message.error("Помилка при збереженні");
    } else {
      setSuccess(true);
      message.success(`${values.entryType === "bonus" ? "Бонус" : "Штраф"} збережено!`);
      form.resetFields();
      form.setFieldsValue({ target: "student", entryType: "bonus", amount: 1 });
    }
    setLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: "500px" }}>
      <div style={{ marginBottom: "8px" }}>
        <Link href="/admin" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>← Адмін</Link>
      </div>

      <div className="page-header">
        <h1>🎁 {className}</h1>
        <p className="subtitle">Бонус / Штраф</p>
      </div>

      {success && <Alert message="✅ Збережено!" type="success" style={{ marginBottom: "16px" }} />}

      <div className="star-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ target: "student", entryType: "bonus", amount: 1 }}
          requiredMark={false}
        >
          <Form.Item name="entryType" label={<span style={{ color: "var(--color-text-muted)" }}>Тип</span>}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="bonus">🎁 Бонус</Radio.Button>
              <Radio.Button value="penalty">⚠️ Штраф</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="target" label={<span style={{ color: "var(--color-text-muted)" }}>Кому</span>}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="student">Учень</Radio.Button>
              <Radio.Button value="class">Весь клас</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.target !== curr.target}
          >
            {({ getFieldValue }) =>
              getFieldValue("target") === "student" ? (
                <Form.Item
                  name="studentId"
                  label={<span style={{ color: "var(--color-text-muted)" }}>Учень</span>}
                  rules={[{ required: true, message: "Оберіть учня" }]}
                >
                  <Select
                    placeholder="Оберіть учня..."
                    showSearch
                    optionFilterProp="label"
                    options={students.map((s) => ({
                      value: s.id,
                      label: `${s.avatar_emoji} ${s.nickname || s.full_name}`,
                    }))}
                    style={{ background: "var(--bg-elevated)" }}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="amount"
            label={<span style={{ color: "var(--color-text-muted)" }}>Кількість зірок</span>}
            rules={[{ required: true, message: "Вкажіть кількість" }]}
          >
            <InputNumber
              min={1}
              max={50}
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              addonAfter="⭐"
            />
          </Form.Item>

          <Form.Item
            name="note"
            label={<span style={{ color: "var(--color-text-muted)" }}>Коментар (необов&apos;язково)</span>}
          >
            <Input.TextArea
              rows={2}
              placeholder="Причина..."
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            style={{
              background: "linear-gradient(135deg, #f5a623, #e8940f)",
              border: "none",
              color: "#1a1830",
              fontWeight: 700,
            }}
          >
            💾 Зберегти
          </Button>
        </Form>
      </div>
    </div>
  );
}
