"use client";

import { Form, Input } from "antd";

/**
 * Поле нотатки до нарахування + підказка мінімізації (Етап 5, п. 11).
 *
 * Нотатка — єдине вільне текстове поле, куди вчитель фізично може написати
 * що завгодно, і єдине, що потім видно учню в його історії. Тому підказка
 * стоїть саме тут і в кожному місці, де нотатка вводиться — окремим
 * компонентом, щоб не розійтися формулюваннями по трьох формах.
 */

export const NOTE_PRIVACY_HINT =
  "Не вносьте відомості про здоров'я, сім'ю чи конфлікти.";

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
      label={<span style={{ fontWeight: 700 }}>{label}</span>}
      extra={
        <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
          ⓘ {NOTE_PRIVACY_HINT}
        </span>
      }
      rules={[{ max: 500, message: "Занадто довга нотатка" }]}
    >
      <Input.TextArea rows={rows} placeholder={placeholder} style={{ borderRadius: "8px" }} />
    </Form.Item>
  );
}
