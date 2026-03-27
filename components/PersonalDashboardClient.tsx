"use client";

import { useEffect, useState } from "react";
import { Progress } from "antd";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { CheckCircleFilled } from "@ant-design/icons";

interface Prize {
  id: string;
  name: string;
  emoji: string;
  stars_required: number;
  sort_order: number;
}

interface LessonEntry {
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  lesson_id: string | null;
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
  last5Lessons: LessonEntry[];
  classId: string;
}

const INDIVIDUAL_THRESHOLDS = [
  { name: "Кіндер", key: "kinder", target: 10 },
  { name: "Стікер", key: "sticker", target: 20 },
  { name: "ПІН", key: "pin", target: 30 },
  { name: "3D-друк", key: "3d", target: 50 },
];

export default function PersonalDashboardClient({
  student,
  totalStars,
  individualStars,
  rank,
  totalStudents,
  prizes,
  last5Lessons,
}: Props) {
  const [displayed, setDisplayed] = useState(0);

  // Animated counter
  useEffect(() => {
    if (totalStars === 0) return;
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
                color: "#F08C00", // Gold-ish
                lineHeight: 1,
              }}
            >
              {displayed}
            </div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "1rem", marginTop: "8px", fontWeight: 800 }}>
              ЗІРОК
            </div>
          </div>

          <div>
            <div style={{ fontSize: "3.5rem", fontWeight: 950, lineHeight: 1 }}>
              {rankMedal(rank)}
            </div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "1rem", marginTop: "8px", fontWeight: 800 }}>
              МІСЦЕ З {totalStudents}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Prize Progress (NEW) */}
      <div className="star-card" style={{ marginBottom: "24px" }}>
        <div style={{ fontWeight: 900, marginBottom: "20px", fontSize: "1.2rem" }}>
          ПРОГРЕС НАГОРОД
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {INDIVIDUAL_THRESHOLDS.map((pt) => {
            const pct = Math.min(100, Math.round((individualStars / pt.target) * 100));
            const isDone = pct >= 100;
            return (
              <div key={pt.key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>{pt.name}</span>
                  <span style={{ color: isDone ? "var(--color-primary)" : "inherit" }}>
                    {isDone ? <CheckCircleFilled /> : `${pct}%`}
                  </span>
                </div>
                <Progress 
                  percent={pct} 
                  showInfo={false} 
                  strokeColor={isDone ? "var(--color-primary)" : "var(--color-text)"}
                  strokeWidth={12}
                  className="heavy-progress"
                />
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "4px", fontWeight: 700 }}>
                  {isDone ? "ОТРИМАНО" : `ЗІБРАНО ${individualStars} З ${pt.target}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History (Renamed from Last 5 lessons) */}
      {last5Lessons.length > 0 && (
        <div className="star-card" style={{ marginBottom: "24px" }}>
          <div style={{ fontWeight: 900, marginBottom: "16px", fontSize: "1.2rem" }}>
            ІСТОРІЯ
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {last5Lessons.map((entry, idx) => {
              const isBonus = entry.type === "bonus";
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
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", fontWeight: 800 }}>
                      {format(new Date(entry.created_at), "d MMM yyyy", { locale: uk }).toUpperCase()}
                    </div>
                    {entry.note && (
                      <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "2px" }}>{entry.note}</div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: isPenalty ? "#E03131" : "#F08C00",
                    }}
                  >
                    {isPenalty ? "" : "+"}{entry.amount}
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
