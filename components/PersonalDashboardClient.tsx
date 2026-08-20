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

/**
 * Запис історії з публічного RPC.
 *
 * Етап 6: підпис запису — це назва й іконка ТИПУ нарахування (entry_types),
 * а не enum lesson/bonus/penalty. Enum зникає в міграції 020; ці поля RPC
 * віддає і до, і після неї, тому компонент однаковий в обох станах.
 */
interface HistoryEntry {
  amount: number;
  type_name: string | null;
  type_icon: string | null;
  note: string | null;
  created_at: string;
}

interface Props {
  student: {
    id: string;
    /** Публічне ім'я: nickname, або ім'я з ПІБ. full_name сюди не потрапляє. */
    display_name: string;
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

  const displayName = student.display_name;

  function rankMedal(r: number) {
    if (r === 1) return "🥇";
    if (r === 2) return "🥈";
    if (r === 3) return "🥉";
    return `#${r}`;
  }

  /**
   * Підпис запису: іконка й назва типу, а якщо тип уже прибрали — нотатка,
   * і лише в останню чергу нейтральне «Нарахування». Ніякого мапінгу за
   * магічними рядками: назви типів задає вчитель.
   */
  function entryTitle(entry: HistoryEntry): string {
    const label = [entry.type_icon, entry.type_name].filter(Boolean).join(" ").trim();
    if (label && entry.note) return `${label}: ${entry.note}`;
    if (label) return label;
    return entry.note || "Нарахування";
  }

  return (
    <div>
      {/* Avatar & Name */}
      <div className="star-card" style={{ textAlign: "center", marginBottom: "24px", padding: "40px 24px" }}>
        <div className="avatar-emoji" style={{ fontSize: "5rem", marginBottom: "16px" }}>
          {student.avatar_emoji}
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: "2.2rem", fontWeight: 900 }}>{displayName}</h2>

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
              const isPenalty = entry.amount < 0;
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
                      {entryTitle(entry)}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 950,
                    fontSize: "1.2rem",
                    color: entry.amount < 0 ? "#E03131" : "var(--color-star)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {(entry.amount > 0 ? "+" : "") + entry.amount}
                    <StarFilled style={{ fontSize: "0.9rem" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        .heavy-progress .ant-progress-inner {
          border: 3px solid var(--color-border) !important;
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
