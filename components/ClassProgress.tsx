import { Progress } from "antd";
import type { PublicClassPrize } from "@/lib/public/classData";

/**
 * Прогрес класу до кожного класового призу.
 *
 * Раніше було рівно два зашиті рядки — Game Day і Pizza Day — бо пороги
 * жили двома стовпцями в `classes`. Тепер призи класу конфігуровані
 * (class_prizes, міграція 016), тож компонент рендерить стільки смуг,
 * скільки їх завів учитель, у його ж порядку.
 */
export default function ClassProgressBars({
  totalStars,
  prizes,
}: {
  totalStars: number;
  prizes: PublicClassPrize[];
}) {
  if (prizes.length === 0) {
    return (
      <div style={{ color: "var(--color-text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>
        Нагороди класу ще не налаштовані.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {prizes.map((prize) => {
        const percent =
          prize.threshold > 0
            ? Math.min(100, Math.round((totalStars / prize.threshold) * 100))
            : 0;
        const reached = percent === 100;

        return (
          <div key={prize.id}>
            <div
              className="progress-label"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontWeight: 800,
              }}
            >
              <span>
                {prize.emoji} {prize.name}
              </span>
              <span style={{ color: reached ? "#20C31A" : "inherit" }}>{percent}%</span>
            </div>
            <Progress
              percent={percent}
              strokeColor={reached ? "#20C31A" : "#000000"}
              trailColor="#e9ecef"
              strokeWidth={20}
              showInfo={false}
            />
            <div
              style={{
                color: "var(--color-text-muted)",
                fontSize: "0.85rem",
                marginTop: "4px",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{prize.threshold} ЗІРОК</span>
              {prize.given_count > 0 && <span>отримано {prize.given_count}×</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
