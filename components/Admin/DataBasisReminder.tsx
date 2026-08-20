"use client";

import { DATA_BASIS_REMINDER } from "@/lib/students/fullName";

/**
 * Неблокуючий рядок-нагадування над формами додавання учнів (Етап 5, п. 9).
 *
 * Свідомо НЕ Alert і НЕ модалка: акцепт вчитель уже дав при реєстрації, тут
 * лише нагадування в момент, коли воно доречне — перед внесенням даних.
 * Блокуючий елемент на цьому місці навчив би клікати «ок» не читаючи.
 */
export default function DataBasisReminder({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
        padding: "10px 12px",
        background: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        fontSize: "0.82rem",
        lineHeight: 1.5,
        color: "#495057",
        ...style,
      }}
    >
      <span aria-hidden style={{ flexShrink: 0 }}>ⓘ</span>
      <span>{DATA_BASIS_REMINDER}</span>
    </div>
  );
}
