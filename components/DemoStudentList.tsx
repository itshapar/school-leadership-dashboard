"use client";

import { Collapse, Tag } from "antd";
import { StarFilled } from "@ant-design/icons";
import type { DemoStudent } from "@/lib/public/demoTeacherView";

export default function DemoStudentList({ students }: { students: DemoStudent[] }) {
  return (
    <Collapse
      accordion
      items={students.map((s) => ({
        key: s.id,
        label: (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "1.4rem" }}>{s.avatar_emoji}</span>
            <span style={{ fontWeight: 800, flex: 1 }}>{s.display_name}</span>
            <span style={{ fontWeight: 900, color: "var(--color-star)", display: "flex", alignItems: "center", gap: "4px" }}>
              {s.total_stars} <StarFilled style={{ fontSize: "0.9rem" }} />
            </span>
          </div>
        ),
        children:
          s.history.length === 0 ? (
            <div style={{ color: "#868e96", fontSize: "0.85rem" }}>Ще немає записів.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {s.history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: h.amount < 0 ? "#FFF5F5" : "#F8F9FA",
                    border: "2px solid #000",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}
                >
                  <span>
                    {h.type_icon ?? ""} {h.type_name ?? "Запис"}
                    {h.note && <span style={{ color: "#868e96", fontWeight: 600 }}> · {h.note}</span>}
                    {h.lesson_date && (
                      <Tag style={{ marginLeft: 8, fontWeight: 600 }}>{h.lesson_date}</Tag>
                    )}
                  </span>
                  <span style={{ color: h.amount < 0 ? "#E03131" : "var(--color-star)" }}>
                    {h.amount > 0 ? "+" : ""}
                    {h.amount}
                  </span>
                </div>
              ))}
            </div>
          ),
      }))}
    />
  );
}
