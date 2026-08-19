"use client";

import { useState } from "react";
import { Form, Input, Button, message } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  display_name: string;
  school_display_name: string | null;
}

/** Редагування профілю вчителя (teacher_profiles, RLS: лише свій рядок). */
export default function ProfileForm({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseClient();

  async function onFinish(values: {
    display_name: string;
    school_display_name?: string;
  }) {
    setLoading(true);
    const { error } = await supabase
      .from("teacher_profiles")
      .update({
        display_name: values.display_name.trim(),
        school_display_name: values.school_display_name?.trim() || null,
      })
      .eq("id", profile.id);
    if (error) {
      message.error("Не вдалося зберегти профіль");
    } else {
      message.success("Профіль збережено");
    }
    setLoading(false);
  }

  return (
    <Form
      layout="vertical"
      onFinish={onFinish}
      requiredMark={false}
      initialValues={{
        display_name: profile.display_name,
        school_display_name: profile.school_display_name ?? "",
      }}
    >
      <Form.Item
        name="display_name"
        label="Ім'я для відображення"
        rules={[
          { required: true, message: "Введіть ім'я" },
          { max: 100, message: "Занадто довге ім'я" },
        ]}
      >
        <Input size="large" placeholder="Оксана Петрівна" />
      </Form.Item>
      <Form.Item
        name="school_display_name"
        label="Назва школи (необов'язково)"
        rules={[{ max: 200, message: "Занадто довга назва" }]}
      >
        <Input size="large" placeholder="Гімназія №1 м. Київ" />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        loading={loading}
        style={{
          background: "linear-gradient(135deg, #f5a623, #e8940f)",
          border: "none",
          fontWeight: 700,
        }}
      >
        Зберегти
      </Button>
    </Form>
  );
}
