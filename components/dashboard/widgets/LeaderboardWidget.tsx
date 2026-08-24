import { StarFilled, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import { Segmented } from "antd";
import React, { useMemo, useState } from "react";
import { splitFullName } from "@/lib/students/fullName";

type SortKey = "rank" | "surname" | "given";

const SORT_OPTIONS: Array<{ label: string; value: SortKey }> = [
  { label: "Рейтинг", value: "rank" },
  { label: "Прізвище", value: "surname" },
  { label: "Ім'я", value: "given" },
];

export default function LeaderboardWidget({ leaderboard, isGlobal, onStudentClick }: any) {
  const [sortBy, setSortBy] = useState<SortKey>("rank");

  const sorted = useMemo(() => {
    if (sortBy === "rank") return leaderboard;
    const collator = new Intl.Collator("uk-UA");
    return [...leaderboard].sort((a: any, b: any) => {
      const partsA = splitFullName(a.student.full_name);
      const partsB = splitFullName(b.student.full_name);
      const key = sortBy === "surname" ? "surname" : "given";
      return collator.compare(partsA[key], partsB[key]);
    });
  }, [leaderboard, sortBy]);

  return (
    <>
      <div
        className="widget-title"
        style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}
      >
        {isGlobal ? "Глобальний Рейтинг" : "Рейтинг Класу"}
        {/* Сортування має сенс лише для одного конкретного класу — на
            агрегованому перегляді (усі паралелі/класи) лишаємо лише
            рейтинг за зірками. */}
        {!isGlobal && (
          <Segmented
            size="small"
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            options={SORT_OPTIONS}
            style={{ fontWeight: 700, textTransform: "none" }}
          />
        )}
      </div>
      <div className="leaderboard-list custom-scrollbar">
        {sorted.map((item: any) => {
          // Золото/срібло/бронза — за СПРАВЖНІМ рейтингом (item.rank), а не
          // позицією в масиві: після сортування за прізвищем/іменем позиція
          // вже не збігається з місцем у рейтингу.
          let rankClass = "";
          if (item.rank === 1) rankClass = "rank-1";
          else if (item.rank === 2) rankClass = "rank-2";
          else if (item.rank === 3) rankClass = "rank-3";

          return (
            <div 
              key={item.student.id} 
              className="leaderboard-item"
              onClick={() => onStudentClick(item)}
            >
              <div className={`leaderboard-rank ${rankClass}`}>{item.rank}</div>
              <div style={{ fontSize: "1.8rem" }}>{item.student.avatar_emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#000" }}>
                  {item.student.nickname || item.student.full_name}
                </div>
                {item.student.nickname && (
                  <div style={{ fontSize: "0.8rem", color: "#868e96", fontWeight: 700 }}>
                    {item.student.full_name}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--color-star, #f59f00)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                  {item.totalStars} <StarFilled style={{ color: "var(--color-star, #f59f00)", fontSize: "0.95rem" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                  {item.trend > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "#40c057" }}>
                      <ArrowUpOutlined style={{ fontSize: "12px" }} /> {item.trend}
                    </div>
                  ) : item.trend < 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "#fa5252" }}>
                      <ArrowDownOutlined style={{ fontSize: "12px" }} /> {Math.abs(item.trend)}
                    </div>
                  ) : (
                    <div style={{ color: "#adb5bd" }}>
                      <MinusOutlined style={{ fontSize: "12px" }} />
                    </div>
                  )}</div>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", color: "#868e96", marginTop: "20px" }}>Немає даних</div>
        )}
      </div>
    </>
  );
}
