"use client";

import { Form, Input } from "antd";

/**
 * Поле нотатки до нарахування.
 *
 * Підказку про мінімізацію даних («не вносьте відомості про здоров'я,
 * сім'ю чи конфлікти») прибрано на прямий запит (живий фідбек): вона
 * висіла під кожним нарахуванням і читалась як зайвий шум. Сам ризик
 * нікуди не подівся — нотатку бачить учень у власній історії, — але
 * рішення показувати чи не показувати цю пораду за вчителем.
 */

export default function EntryNoteField({
  name = "note",
  label = "Причина (необов'язково)",
  placeholder = "Наприклад: за активну участь на уроці",
  rows = 3,
}: {
  name?: string;
  label?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Form.Item
      name={name}
      label={<span style={{ fontWeight: 600 }}>{label}</span>}
      rules={[{ max: 500, message: "Занадто довга нотатка" }]}
    >
      <Input.TextArea rows={rows} placeholder={placeholder} style={{ borderRadius: "8px" }} />
    </Form.Item>
  );
}
