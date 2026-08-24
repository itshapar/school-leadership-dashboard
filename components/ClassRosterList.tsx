"use client";

import { useMemo, useState } from "react";
import { Segmented } from "antd";
import { StarFilled } from "@ant-design/icons";
import { splitFullName } from "@/lib/students/fullName";

/**
 * Список класу на дашборді, який бачить УЧЕНЬ (не адмінський). Сортування
 * тут навмисно, а не на агрегованому дашборді вчителя (9.11, живий
 * фідбек) — раніше його помилково додали до LeaderboardWidget.
 */

interface RosterStudent {
  id: string;
  display_name: string;
  full_name: string | null;
  avatar_emoji: string;
  stars?: number;
}

type SortKey = "stars" | "surname" | "given";

export default function ClassRosterList({ students }: { students: RosterStudent[] }) {
  const canSortByStars = students.some((s) => typeof s.stars === "number");
  const [sortBy, setSortBy] = useState<SortKey>(canSortByStars ? "stars" : "surname");

  const sortOptions = useMemo(() => {
    const opts: Array<{ label: string; value: SortKey }> = [];
    if (canSortByStars) opts.push({ label: "Зірки", value: "stars" });
    opts.push({ label: "Прізвище", value: "surname" }, { label: "Ім'я", value: "given" });
    return opts;
  }, [canSortByStars]);

  const sorted = useMemo(() => {
    if (sortBy === "stars") {
      return [...students].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    }
    const collator = new Intl.Collator("uk-UA");
    return [...students].sort((a, b) => {
      const partsA = splitFullName(a.full_name);
      const partsB = splitFullName(b.full_name);
      return collator.compare(partsA[sortBy], partsB[sortBy]);
    });
  }, [students, sortBy]);

  return (
    <div className="star-card" style={{ padding: "24px 16px" }}>
      {sortOptions.length > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "2px solid #f1f3f5",
          }}
        >
          <Segmented
            size="small"
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            options={sortOptions}
          />
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
