"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { StarFilled } from "@ant-design/icons";

export default function ClassGoalsWidget({ classInfo, leaderboard }: any) {
  const totalStars = leaderboard.reduce((sum: number, s: any) => sum + s.totalStars, 0);
  
  const renderChart = (title: string, current: number, target: number, color: string) => {
    const percent = Math.min(100, Math.round((current / target) * 100));
    const data = [
      { name: 'Completed', value: percent },
      { name: 'Remaining', value: 100 - percent }
    ];
    
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "6px", color: "#000000" }}>{title}</div>
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
          <div style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)",
            fontWeight: 900,
            fontSize: "1rem",
            color: "#000000"
          }}>
            {percent}%
          </div>
        </div>
        <div style={{ fontSize: "0.8rem", color: "#495057", fontWeight: 800, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
          {current} / {target} <StarFilled style={{ color: "var(--color-star, #f59f00)", fontSize: "0.85rem" }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="widget-title">
        Епічні Цілі Класу
      </div>
      
      <div style={{ display: "flex", flex: 1, gap: "16px", minHeight: 0, width: "100%", alignItems: "center" }}>
        {classInfo ? (
          <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "0 20px" }}>
            {renderChart("Game Day", totalStars, classInfo.game_day_threshold, "#40c057")}
            {renderChart("Pizza Day", totalStars, classInfo.pizza_day_threshold, "#f59f00")}
          </div>
        ) : (
          <div style={{
            background: "#f8f9fa",
            border: "2px dashed #ced4da",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            color: "#868e96",
            fontSize: "0.85rem",
            fontWeight: 700,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            Оберіть клас, щоб побачити прогрес цілей
          </div>
        )}
      </div>
    </>
  );
}
