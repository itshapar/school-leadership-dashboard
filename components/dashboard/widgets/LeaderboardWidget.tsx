import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function LeaderboardWidget({ leaderboard, isGlobal, onStudentClick }: any) {
  return (
    <>
      <div className="widget-title">
        <Trophy size={20} color="#f59f00" />
        {isGlobal ? "Глобальний Топ" : "Топ Класу"}
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
                  <div style={{ fontSize: "0.8rem", color: "#868e96", fontWeight: 700 }}>
                    {item.student.full_name}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--color-star, #f59f00)" }}>
                  {item.totalStars} ⭐
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                  {item.trend > 0 ? (
                    <span className="trend-up"><TrendingUp size={12} /> +{item.trend}</span>
                  ) : item.trend < 0 ? (
                    <span className="trend-down"><TrendingDown size={12} /> {item.trend}</span>
                  ) : (
                    <span className="trend-flat"><Minus size={12} /></span>
                  )}
                </div>
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
