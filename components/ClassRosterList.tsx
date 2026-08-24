"use client";

import { useMemo, useState } from "react";
import { StarFilled } from "@ant-design/icons";
import { splitFullName } from "@/lib/students/fullName";

/**
 * Список класу на дашборді, який бачить УЧЕНЬ (не адмінський). Сортування
 * тут навмисно, а не на агрегованому дашборді вчителя (9.11, живий
 * фідбек) — раніше його помилково додали до LeaderboardWidget.
 *
 * Лише "Зірки" і "Прізвище" (9.12, живий фідбек) — сортування за іменем
 * прибрали, воно не було потрібне. Перемикач — ті самі "чипи", що й
 * фільтри паралелі/класу на дашборді вчителя, для єдиного стилю замість
 * дефолтного antd Segmented.
 */

interface RosterStudent {
  id: string;
  display_name: string;
  full_name: string | null;
  avatar_emoji: string;
  stars?: number;
}

type SortKey = "stars" | "surname";

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: "20px",
  background: active ? "#000" : "#ffffff",
  color: active ? "#fff" : "#495057",
  fontWeight: 700,
  fontSize: "0.85rem",
  border: active ? "2px solid #000" : "2px solid #dee2e6",
  boxShadow: active ? "2px 2px 0px var(--color-star, #f59f00)" : "none",
  cursor: "pointer",
});

export default function ClassRosterList({ students }: { students: RosterStudent[] }) {
  const canSortByStars = students.some((s) => typeof s.stars === "number");
  const [sortBy, setSortBy] = useState<SortKey>(canSortByStars ? "stars" : "surname");

  const sorted = useMemo(() => {
    if (sortBy === "stars") {
      return [...students].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    }
    const collator = new Intl.Collator("uk-UA");
    return [...students].sort((a, b) =>
      collator.compare(splitFullName(a.full_name).surname, splitFullName(b.full_name).surname)
    );
  }, [students, sortBy]);

  return (
    <div className="star-card" style={{ padding: "24px 16px" }}>
      {canSortByStars && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "2px solid #f1f3f5",
          }}
        >
          <button type="button" onClick={() => setSortBy("stars")} style={chipStyle(sortBy === "stars")}>
            Зірки
          </button>
          <button type="button" onClick={() => setSortBy("surname")} style={chipStyle(sortBy === "surname")}>
            Прізвище
          </button>
        </div>
      )}
      {sorted.map((student) => (
        <div key={student.id} className="leaderboard-row">
          <div style={{ fontSize: "1.8rem" }}>{student.avatar_emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 850, fontSize: "1.1rem", color: "#000000" }}>
              {student.display_name}
            </div>
            {student.full_name && (
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontWeight: 700 }}>
                {student.full_name}
              </div>
            )}
          </div>
          {typeof student.stars === "number" && (
            <div style={{ fontWeight: 900, color: "var(--color-star)", display: "flex", alignItems: "center", gap: "4px" }}>
              {student.stars} <StarFilled style={{ fontSize: "0.9rem" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
