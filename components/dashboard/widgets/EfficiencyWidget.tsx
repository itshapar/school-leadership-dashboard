"use client";

import { Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function EfficiencyWidget({ leaderboard }: any) {
  // Sort by efficiency (highest first) and take top 5
  const data = [...leaderboard]
    .filter(s => s.lessonsAttended > 0)
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5)
    .map(s => ({
      name: s.student.nickname || s.student.full_name.split(" ")[0],
      efficiency: s.efficiency,
      avatar: s.student.avatar_emoji
    }));

  return (
    <>
      <div className="widget-title">
        <Activity size={20} color="#0c8599" />
        Топ Ефективності
        <span style={{ fontSize: "0.75rem", color: "#868e96", marginLeft: "auto", fontWeight: 600 }}>
          Зірок за урок
        </span>
      </div>
      
      <div style={{ flex: 1, width: "100%", minHeight: 0 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fontWeight: 700, fill: "#495057" }}
                width={80}
              />
              <Tooltip 
                cursor={{ fill: '#f1f3f5' }}
                contentStyle={{ borderRadius: "8px", border: "2px solid #000", fontWeight: 800 }}
              />
              <Bar dataKey="efficiency" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? "#f59f00" : "#74c0fc"} />
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
    </>
  );
}
