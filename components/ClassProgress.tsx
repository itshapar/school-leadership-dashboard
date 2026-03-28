import { Progress } from "antd";

interface Props {
  totalStars: number;
  gameDayThreshold: number;
  pizzaDayThreshold: number;
}

export default function ClassProgressBars({
  totalStars,
  gameDayThreshold,
  pizzaDayThreshold,
}: Props) {
  const gamePercent = Math.min(100, Math.round((totalStars / gameDayThreshold) * 100));
  const pizzaPercent = Math.min(100, Math.round((totalStars / pizzaDayThreshold) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <div className="progress-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 800 }}>
          <span>Ігровий день</span>
          <span style={{ color: gamePercent === 100 ? "#52C41A" : "inherit" }}>
            {gamePercent}%
          </span>
        </div>
        <Progress
          percent={gamePercent}
          strokeColor={gamePercent === 100 ? "#52C41A" : "#000000"}
          trailColor="#e9ecef"
          strokeWidth={20}
          showInfo={false}
        />
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "4px", fontWeight: 700 }}>
          {gameDayThreshold} ЗІРОК
        </div>
      </div>

      <div>
        <div className="progress-label" style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: 800 }}>
          <span>Pizza Day</span>
          <span style={{ color: pizzaPercent === 100 ? "#52C41A" : "inherit" }}>
            {pizzaPercent}%
          </span>
        </div>
        <Progress
          percent={pizzaPercent}
          strokeColor={pizzaPercent === 100 ? "#52C41A" : "#000000"}
          trailColor="#e9ecef"
          strokeWidth={20}
          showInfo={false}
        />
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: "4px", fontWeight: 700 }}>
          {pizzaDayThreshold} ЗІРОК
        </div>
      </div>
    </div>
  );
}
