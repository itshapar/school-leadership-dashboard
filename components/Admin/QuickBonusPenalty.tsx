"use client";

import { useState } from "react";
import { Button, Modal, Form, Select, InputNumber, Input, Space, message } from "antd";
import { PlusCircleOutlined, MinusCircleOutlined, UserOutlined, TeamOutlined } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export default function QuickBonusPenalty({ classId, students }: { classId: string, students: Student[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"bonus" | "penalty">("bonus");
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const openModal = (t: "bonus" | "penalty") => {
    setType(t);
    setIsOpen(true);
    form.setFieldsValue({ type: t, amount: 1, target: "student" });
  };

  const handleFinish = async (values: any) => {
    setLoading(true);
    const supabase = getSupabaseClient();
    
    const amount = type === "penalty" ? -Math.abs(values.amount) : Math.abs(values.amount);
    
    const entries = values.target === "class" 
      ? [{ class_id: classId, student_id: null, type, amount, note: values.note || null }]
      : [{ class_id: classId, student_id: values.studentId, type, amount, note: values.note || null }];

    const { error } = await supabase.from("star_entries").insert(entries);

    if (error) {
      message.error("Помилка при збереженні");
    } else {
      message.success(`${type === "bonus" ? "Бонус" : "Штраф"} додано!`);
      setIsOpen(false);
      form.resetFields();
    }
    setLoading(false);
  };

  return (
    <>
      <Space size="middle">
        <Button 
          onClick={() => openModal("bonus")}
          size="large"
          style={{ 
            background: "#ebfbee", 
            color: "#2f9e44", 
            border: "2px solid #2f9e44", 
            fontWeight: 800,
            borderRadius: "10px",
            height: "44px",
            boxShadow: "2px 2px 0px #2f9e44"
          }}
        >
          БОНУС
        </Button>
        <Button 
          onClick={() => openModal("penalty")}
          size="large"
          danger
          style={{ 
            fontWeight: 800, 
            border: "2px solid #e03131", 
            borderRadius: "10px", 
            height: "44px",
            boxShadow: "2px 2px 0px #e03131"
          }}
        >
          ШТРАФ
        </Button>
      </Space>

      <Modal
        title={type === "bonus" ? "Додати бонус" : "Додати штраф"}
        open={isOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsOpen(false)}
        confirmLoading={loading}
        okText="Зберігти"
        cancelText="Скасувати"
        okButtonProps={{ size: "large", style: { fontWeight: 700 } }}
        cancelButtonProps={{ size: "large" }}
        footer={[
          <Button key="back" onClick={() => setIsOpen(false)} size="large">
            Скасувати
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()} loading={loading} size="large" style={{ fontWeight: 700 }}>
            Зберігти
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: "24px" }}>
          <Form.Item name="target" label={<span style={{ fontWeight: 700 }}>Кому призначити?</span>} initialValue="student">
            <Select size="large" options={[
              { value: "student", label: "Конкретному учню" },
              { value: "class", label: "Усьому класу" }
            ]} />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.target !== curr.target}>
            {({ getFieldValue }) => getFieldValue("target") === "student" && (
              <Form.Item name="studentId" label={<span style={{ fontWeight: 700 }}>Учень</span>} rules={[{ required: true, message: "Оберіть учня" }]}>
                <Select
                  size="large"
                  showSearch
                  placeholder="Пошук учня за прізвищем..."
                  optionFilterProp="label"
                  options={students.map(s => ({
                    value: s.id,
                    label: `${s.avatar_emoji} ${s.full_name} ${s.nickname ? `(${s.nickname})` : ""}`
                  }))}
                />
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item name="amount" label={<span style={{ fontWeight: 700 }}>Кількість зірок</span>} rules={[{ required: true }]}>
            <InputNumber min={1} max={50} size="large" addonAfter="⭐" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="note" label={<span style={{ fontWeight: 700 }}>Причина (необов'язково)</span>}>
            <Input.TextArea rows={3} placeholder="Наприклад: за активну участь на уроці" style={{ borderRadius: "8px" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
