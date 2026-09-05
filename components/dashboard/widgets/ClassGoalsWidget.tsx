"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { ClassPrizeLite } from "@/lib/analytics";
import StarIcon from "@/components/StarIcon";
import { sortClassPrizes } from "@/lib/prizeOrder";

/**
 * «Епічні цілі класу» — прогрес до кожного класового призу.
 *
 * Раніше два зашиті пончики Game Day / Pizza Day читали
 * classInfo.game_day_threshold та .pizza_day_threshold. Тепер цілі
 * конфігуровані (class_prizes, міграція 016), тож віджет рендерить чотири
 * найдешевші призи вчителя — далі пончики стають нечитабельними, і решту
 * видно на публічній сторінці класу.
 */

const CHART_COLORS = ["#20C31A", "#f59f00", "#7048e8", "#1971c2"];

/** Скільки цілей показуємо; решта свідомо не влазить у віджет. */
const MAX_GOALS = 4;

interface ClassInfo {
  id: string;
  class_prizes?: ClassPrizeLite[];
}

interface LeaderboardRow {
  totalStars: number;
}

export default function ClassGoalsWidget({
  classInfo,
  leaderboard,
}: {
  classInfo: ClassInfo | null;
  leaderboard: LeaderboardRow[];
}) {
  const totalStars = leaderboard.reduce((sum, s) => sum + s.totalStars, 0);
  // Спершу найдешевші цілі: у віджет влазять чотири, і корисніші саме ті,
  // до яких клас найближче.
  const prizes = sortClassPrizes(classInfo?.class_prizes ?? []).slice(0, MAX_GOALS);
  const hiddenCount = (classInfo?.class_prizes?.length ?? 0) - prizes.length;

  const renderChart = (prize: ClassPrizeLite, color: string) => {
    const percent =
      prize.threshold > 0
        ? Math.min(100, Math.round((totalStars / prize.threshold) * 100))
        : 0;
    const data = [
      { name: "Completed", value: percent },
      { name: "Remaining", value: 100 - percent },
    ];

    return (
      <div
        key={prize.id}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.95rem",
            marginBottom: "6px",
            color: "#000000",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
          title={prize.name}
        >
          {prize.emoji} {prize.name}
        </div>
        <div style={{ width: "100%", height: "110px", position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={45}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#f1f3f5" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontWeight: 900,
              fontSize: "1rem",
              color: "#000000",
            }}
          >
            {percent}%
          </div>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "#495057",
            fontWeight: 800,
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          {totalStars} / {prize.threshold}{" "}
          <StarIcon size="0.85rem" />
        </div>
      </div>
    );
  };

  const emptyState = (text: string) => (
    <div
      style={{
        background: "#f8f9fa",
        border: "2px dashed #ced4da",
        borderRadius: "12px",
        padding: "24px",
        textAlign: "center",
        color: "#868e96",
        fontSize: "0.85rem",
        fontWeight: 600,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {text}
    </div>
  );

  return (
    <>
      <div className="widget-title">Епічні Цілі Класу</div>

      <div
        style={{
          display: "flex",
          flex: 1,
          gap: "16px",
          minHeight: 0,
          width: "100%",
          alignItems: "center",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {!classInfo ? (
          emptyState("Оберіть клас, щоб побачити прогрес цілей")
        ) : prizes.length === 0 ? (
          emptyState("У цього класу ще немає класових нагород")
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                width: "100%",
                padding: "0 20px",
              }}
            >
              {prizes.map((prize, i) => renderChart(prize, CHART_COLORS[i % CHART_COLORS.length]))}
            </div>
            {hiddenCount > 0 && (
              <div style={{ fontSize: "0.75rem", color: "#868e96", fontWeight: 600 }}>
                та ще {hiddenCount} на сторінці класу
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
