"use client";

import { Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function ClassGoalsWidget({ classInfo, leaderboard }: any) {
  if (!classInfo) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#868e96", textAlign: "center" }}>
        <Target size={32} style={{ marginBottom: "12px" }} />
        <div style={{ fontWeight: 800 }}>Оберіть клас</div>
        <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Цілі розраховуються для конкретного класу</div>
      </div>
    );
  }

  const totalStars = leaderboard.reduce((sum: number, s: any) => sum + s.totalStars, 0);
  
  const renderChart = (title: string, current: number, target: number, color: string) => {
    const percent = Math.min(100, Math.round((current / target) * 100));
    const data = [
      { name: 'Completed', value: percent },
      { name: 'Remaining', value: 100 - percent }
    ];
    
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "8px" }}>{title}</div>
        <div style={{ width: "100%", height: "120px", position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
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
          <div style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)",
            fontWeight: 900,
            fontSize: "1rem"
          }}>
            {percent}%
          </div>
        </div>
        <div style={{ fontSize: "0.75rem", color: "#868e96", fontWeight: 700, marginTop: "4px" }}>
          {current} / {target} ⭐
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="widget-title">
        <Target size={20} color="#e8590c" />
        Епічні Цілі Класу
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", flex: 1, alignItems: "center" }}>
        {renderChart("Game Day", totalStars, classInfo.game_day_threshold, "#40c057")}
        {renderChart("Pizza Day", totalStars, classInfo.pizza_day_threshold, "#f59f00")}
      </div>
    </>
  );
}
