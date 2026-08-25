import { StarFilled, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from "@ant-design/icons";
import React from "react";

export default function LeaderboardWidget({ leaderboard, isGlobal, onStudentClick }: any) {
  return (
    <>
      <div className="widget-title">
        {isGlobal ? "Глобальний Рейтинг" : "Рейтинг Класу"}
      </div>
      <div className="leaderboard-list custom-scrollbar">
        {leaderboard.map((item: any, idx: number) => {
          let rankClass = "";
          if (idx === 0) rankClass = "rank-1";
          else if (idx === 1) rankClass = "rank-2";
          else if (idx === 2) rankClass = "rank-3";

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
                  <div style={{ fontSize: "0.8rem", color: "#868e96", fontWeight: 600 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "#52C51A" }}>
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
        {leaderboard.length === 0 && (
          <div style={{ textAlign: "center", color: "#868e96", marginTop: "20px" }}>Немає даних</div>
        )}
      </div>
    </>
  );
}
