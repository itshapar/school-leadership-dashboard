"use client";

import { useEffect, useState } from "react";
import { Progress } from "antd";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { CheckCircleFilled, HistoryOutlined, LockOutlined, TrophyOutlined } from "@ant-design/icons";
import StarIcon from "@/components/StarIcon";
import { sortIndividualPrizes } from "@/lib/prizeOrder";

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
  /**
   * Дата уроку (YYYY-MM-DD) для зірок за урок, null для бонусів і штрафів.
   * Запис за урок показується датою, коли урок БУВ, а не коли вчитель
   * заповнив журнал: вчитель часто вносить кілька уроків одним заходом, і
   * без цього учень бачив три різні уроки однією сьогоднішньою датою
   * (живий фідбек).
   */
  occurred_on?: string | null;
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
  /**
   * Місце в класі. null — коли вчитель вимкнув конкурентне середовище
   * (`show_classmate_stars`): тоді учень не бачить ані зірок однокласників,
   * ані власного місця серед них. Блок рангу в цьому разі не малюється
   * взагалі, а не показується прочерком (живий фідбек).
   */
  rank: number | null;
  totalStudents: number | null;
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

  /**
   * Дата запису: для зірок за урок — дата уроку, інакше момент нарахування.
   * `occurred_on` розбирається вручну, а не через `new Date("YYYY-MM-DD")`:
   * такий рядок парситься як UTC-опівніч і в зонах на захід від Гринвіча
   * показував би попередній день.
   */
  function entryDate(entry: HistoryEntry): Date {
    if (entry.occurred_on) {
      const [y, m, d] = entry.occurred_on.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date(entry.created_at);
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
                fontWeight: 900,
                color: "var(--color-star)",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              {displayed} <StarIcon size="2.5rem" color="currentColor" />
            </div>
          </div>

          {rank !== null && (
            <div>
              <div style={{
                fontSize: "3.5rem",
                fontWeight: 900,
                lineHeight: 1,
                color: "#adb5bd"
              }}>
                #{rank}
              </div>
            </div>
          )}
        </div>
      </div>

      {/*
        Пояснення приватності (9.17, живий фідбек) — окрема картка під
        аватаром/зірками/рангом, а не лише спливне повідомлення: попап
        зникає, а це лишається видимим, поки учень на сторінці.
      */}
      <div
        className="star-card"
        style={{
          marginBottom: "24px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#f8f9fa",
        }}
      >
        <LockOutlined style={{ fontSize: "1.3rem", flexShrink: 0 }} />
        {/* Чорним, не сірим (живий фідбек): це не другорядна примітка, а
            обіцянка приватності, яку учень має прочитати. */}
        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text)" }}>
          Цю сторінку бачиш лише ти та вчитель. Однокласники доступу до неї не мають.
        </div>
      </div>

      {/* Individual Prize Progress (NEW Logic) */}
      <div className="star-card" style={{ marginBottom: "24px" }}>
        <div style={{ fontWeight: 900, marginBottom: "20px", fontSize: "1.2rem" }}>
          ПРОГРЕС НАГОРОД
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Від найдешевшої нагороди до найдорожчої: учень має бачити
              найближчу мету першою, а не ту, яку вчитель завів раніше. */}
          {sortIndividualPrizes(prizes).map((p, idx) => {
            const pct = Math.min(100, Math.round((individualStars / p.stars_required) * 100));
            const hasThreshold = individualStars >= p.stars_required;
            const isGiven = givenPrizes[p.id] || false;
            const titleText = p.name;
            
            return (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 800, fontSize: "0.95rem" }}>
                  <span>{titleText}</span>
                  <span style={{ color: isGiven ? "#20C31A" : "inherit" }}>
                    {isGiven || hasThreshold ? "100%" : `${pct}%`}
                  </span>
                </div>
                <Progress 
                  percent={pct} 
                  showInfo={false} 
                  strokeColor={isGiven ? "#20C31A" : (hasThreshold ? "#fcc419" : "#000000")}
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
                        {format(entryDate(entry), "d MMM yyyy", { locale: uk }).toUpperCase()}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                      {entryTitle(entry)}
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 900,
                    fontSize: "1.2rem",
                    color: entry.amount < 0 ? "#E03131" : "var(--color-star)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {(entry.amount > 0 ? "+" : "") + entry.amount}
                    <StarIcon size="0.9rem" color="currentColor" />
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
