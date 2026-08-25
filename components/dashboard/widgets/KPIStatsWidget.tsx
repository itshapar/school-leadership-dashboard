import { FireOutlined } from "@ant-design/icons";

export default function KPIStatsWidget({ kpi }: any) {
  const diff = kpi.bonusesThisMonth - kpi.bonusesLastMonth;
  const isUp = diff >= 0;

  return (
    <>
      <div className="widget-title" style={{ marginBottom: "8px" }}>
        Бонуси Місяця
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1, color: "#000" }}>
          {kpi.bonusesThisMonth}
        </div>
        <div style={{ 
          fontSize: "0.9rem", 
          fontWeight: 600, 
          color: isUp ? "#20C31A" : "#fa5252",
          marginTop: "8px",
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}>
          {isUp ? "▲" : "▼"} {Math.abs(diff)} vs мин. місяць
        </div>
      </div>
    </>
  );
}
