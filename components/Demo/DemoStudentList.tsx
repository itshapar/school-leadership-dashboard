"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import StarIcon from "@/components/StarIcon";
import type { DemoTeacherStudent } from "@/lib/public/classData";

/**
 * Список учнів демо-класу з розкривною історією нарахувань.
 *
 * Історія лежить у тих самих даних, що й список (один RPC на всю сторінку),
 * тому розкриття не робить запитів: це чиста робота з уже отриманим масивом.
 */

function formatDate(iso: string | null): string {
  if (!iso) return "без уроку";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export default function DemoStudentList({ students }: { students: DemoTeacherStudent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {students.map((s) => {
        const open = openId === s.id;
        return (
          <div key={s.id} className="star-card" style={{ padding: "14px 18px" }}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              aria-expanded={open}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{s.avatar_emoji}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: "1rem" }}>
                {s.display_name}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                {s.total_stars}
                <StarIcon size="1.1rem" />
              </span>
              <CaretDown
                weight="bold"
                style={{
                  fontSize: "1.1rem",
                  flexShrink: 0,
                  transition: "transform 0.2s ease",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {open && (
              <div style={{ marginTop: 14, borderTop: "2px solid #e9ecef", paddingTop: 12 }}>
                {s.history.length === 0 ? (
                  <div style={{ color: "var(--color-text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>
                    Нарахувань поки немає.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {s.history.map((h, i) => (
                      <div
                        key={`${s.id}-${i}`}
                        style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem" }}
                      >
                        <span style={{ fontSize: "1rem" }}>{h.type_icon ?? "⭐"}</span>
                        <span style={{ fontWeight: 800 }}>{h.type_name ?? "Нарахування"}</span>
                        <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
                          {formatDate(h.lesson_date)}
                        </span>
                        {h.note && (
                          <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
                            {h.note}
                          </span>
                        )}
                        <span
                          style={{
                            marginLeft: "auto",
                            fontWeight: 900,
                            color: h.amount < 0 ? "#c92a2a" : "#2b8a3e",
                          }}
                        >
                          {h.amount > 0 ? `+${h.amount}` : h.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
