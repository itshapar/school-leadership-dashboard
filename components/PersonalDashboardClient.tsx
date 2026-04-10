"use client";

import { useEffect, useState } from "react";
import { Progress } from "antd";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { StarFilled, CheckCircleFilled, HistoryOutlined, TrophyOutlined } from "@ant-design/icons";

interface Prize {
  id: string;
  name: string;
  emoji: string;
  stars_required: number;
  sort_order: number;
}

interface HistoryEntry {
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  lesson_id?: string | null;
}

interface Props {
  student: {
    id: string;
    full_name: string;
    nickname: string | null;
    avatar_emoji: string;
  };
  totalStars: number;
  individualStars: number;
  rank: number;
  totalStudents: number;
  prizes: Prize[];
  givenPrizes: Record<string, boolean>;
  history: HistoryEntry[];
  classId: string;
}



export default function PersonalDashboardClient({
  student,
  totalStars,
  individualStars,
  rank,
  totalStudents,
  prizes,
  givenPrizes,
  history,
}: Props) {
  const [displayed, setDisplayed] = useState(0);

  // Animated counter
  useEffect(() => {
    if (totalStars === 0) {
      setDisplayed(0);
      return;
    }
    const duration = 1200;
    const steps = 60;
    const increment = totalStars / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= totalStars) {
        setDisplayed(totalStars);
        clearInterval(timer);
      } else {
        setDisplayed(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [totalStars]);

  const displayName = student.nickname || student.full_name.split(" ")[0];

  function rankMedal(r: number) {
    if (r === 1) return "🥇";
    if (r === 2) return "🥈";
    if (r === 3) return "🥉";
    return `#${r}`;
  }

  function getEntryLabel(entry: HistoryEntry) {
    if (entry.type === "lesson" && entry.amount === -1) return "Не було";
    if (entry.type === "lesson") return "Урок";
    if (entry.type === "bonus") return "БОНУС";
    if (entry.type === "penalty") return "ШТРАФ";
    return "Інше";
  }

  return (
    <div>
      {/* Avatar & Name */}
      <div className="star-card" style={{ textAlign: "center", marginBottom: "24px", padding: "40px 24px" }}>
        <div className="avatar-emoji" style={{ fontSize: "5rem", marginBottom: "16px" }}>
          {student.avatar_emoji}
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: "2.2rem", fontWeight: 900 }}>{displayName}</h2>
        {student.nickname && (
          <div style={{ color: "var(--color-text-muted)", fontSize: "1rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
            {student.full_name}
          </div>
        )}

        {/* Stars & Rank row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "48px",
            marginTop: "32px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "3.5rem",
                fontWeight: 950,
                color: "var(--color-star)",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              {displayed} <StarFilled style={{ fontSize: "2.5rem" }} />
            </div>
          </div>

          <div>
            <div style={{
              fontSize: "3.5rem",
              fontWeight: 950,
              lineHeight: 1,
              color: "#adb5bd"
            }}>
              #{rank}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Prize Progress (NEW Logic) */}
      <div className="star-card" style={{ marginBottom: "24px" }}>
        <div style={{ fontWeight: 900, marginBottom: "20px", fontSize: "1.2rem" }}>
          ПРОГРЕС НАГОРОД
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {prizes.map((p, idx) => {
            const pct = Math.min(100, Math.round((individualStars / p.stars_required) * 100));
            const hasThreshold = individualStars >= p.stars_required;
            const isGiven = givenPrizes[p.id] || false;
            const titleText = p.name;
            
            return (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>{titleText}</span>
                  <span style={{ color: isGiven ? "#51cf66" : "inherit" }}>
                    {isGiven || hasThreshold ? "100%" : `${pct}%`}
                  </span>
                </div>
                <Progress 
                  percent={pct} 
                  showInfo={false} 
                  strokeColor={isGiven ? "#51cf66" : (hasThreshold ? "#fcc419" : "#000000")}
                  strokeWidth={12}
                  className="heavy-progress"
                />
                <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "4px", fontWeight: 800, textTransform: "uppercase" }}>
                  {isGiven 
                    ? "ОТРИМАНО" 
                    : (hasThreshold ? "ОЧІКУЙ НА НАГОРОДУ" : `${p.stars_required} ЗІРОК`)
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="star-card" style={{ marginBottom: "24px" }}>
          <div style={{ fontWeight: 900, marginBottom: "16px", fontSize: "1.2rem" }}>
            ІСТОРІЯ ЗІРОК
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {history.map((entry, idx) => {
              const isPenalty = entry.type === "penalty" || entry.amount < 0;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "12px 16px",
                    background: isPenalty ? "#FFF5F5" : "#FFFFFF",
                    border: "2px solid var(--color-border)",
                    borderRadius: "12px",
                    boxShadow: "2px 2px 0px var(--color-border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <div style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", fontWeight: 800 }}>
                        {format(new Date(entry.created_at), "d MMM yyyy", { locale: uk }).toUpperCase()}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: "1rem", fontWeight: 700 }}>
                      {entry.type === "lesson" 
                        ? (entry.note || "Урок або домашнє")
                        : (entry.type === "bonus" ? "🎁 БОНУС" : "⚠️ ШТРАФ")
                      }
                      {entry.type !== "lesson" && entry.note && `: ${entry.note}`}
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: 950, 
                    fontSize: "1.2rem", 
                    color: (entry.type === "lesson" && entry.amount === -1) ? "#adb5bd" : (entry.amount < 0 ? "#E03131" : "var(--color-star)"), 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "4px" 
                  }}>
                    {(entry.type === "lesson" && entry.amount === -1) ? "Н" : (entry.amount > 0 ? "+" : "") + entry.amount} 
                    {!(entry.type === "lesson" && entry.amount === -1) && <StarFilled style={{ fontSize: "0.9rem" }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        .heavy-progress .ant-progress-inner {
          border: 2px solid var(--color-border) !important;
          background: #fff !important;
          border-radius: 8px !important;
          height: 18px !important;
        }
        .heavy-progress .ant-progress-bg {
          height: 12px !important;
          border-radius: 4px !important;
        }
      `}</style>
    </div>
  );
}
