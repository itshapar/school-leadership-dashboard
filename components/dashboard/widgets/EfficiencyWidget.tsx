"use client";

import React from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function EfficiencyWidget({ leaderboard }: any) {
  // Sort leaderboard by efficiency for the chart
  const sorted = [...leaderboard].sort((a, b) => b.efficiency - a.efficiency).slice(0, 10);
  
  const chartData = sorted.map((s, i) => ({
    name: s.student.avatar_emoji || "👤",
    fullName: s.student.nickname || s.student.full_name.split(" ")[0],
    efficiency: s.efficiency
  }));

  return (
    <>
      <div className="widget-title">
        Топ Ефективності
      </div>
      
      <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Scrollable Container for the chart */}
        <div className="custom-scrollbar" style={{ flex: 1, width: "100%", overflowY: "auto", paddingRight: "6px" }}>
          <div style={{ width: "100%", height: "400px" }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  layout="vertical" 
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" horizontal={true} vertical={true} />
                  <XAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 800, fill: "#495057" }} 
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 18 }}
                    width={40}
                    interval={0} // Forces Recharts to show EVERY single tick emoji!
                  />
                  <Tooltip 
                    cursor={{ fill: '#fdfaf5' }}
                    contentStyle={{ 
                      borderRadius: "12px", 
                      border: "3px solid #000000", 
                      boxShadow: "4px 4px 0px #000000",
                      fontFamily: "inherit",
                      fontWeight: 800 
                    }}
                    formatter={(value: any) => [value, "Зірок за урок"]}
                    labelFormatter={(label, items) => {
                      const item = items[0]?.payload;
                      return item ? `${item.name} ${item.fullName}` : label;
                    }}
                  />
                  <Bar dataKey="efficiency" radius={[0, 6, 6, 0]} barSize={16}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#f59f00" : "#74c0fc"} stroke="#000000" strokeWidth={2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#868e96" }}>
                Немає даних
              </div>
            )}
          </div>
        </div>
        
        {/* Caption at the bottom */}
        <div style={{ 
          textAlign: "center", 
          fontSize: "0.75rem", 
          color: "#868e96", 
          fontWeight: 800, 
          marginTop: "12px",
          borderTop: "2px solid #e9ecef",
          paddingTop: "8px" 
        }}>
          Середня кількість зірок за один відвіданий урок
        </div>
      </div>
    </>
  );
}
