"use client";

import React from "react";
import { StarFilled } from "@ant-design/icons";

const REWARDS = [
  { stars: 10, emoji: "🍬" },
  { stars: 20, emoji: "🎨" },
  { stars: 30, emoji: "📌" },
  { stars: 40, emoji: "🤖" },
];

export default function LootRoadWidget({ leaderboard, classInfo }: any) {
  const maxScaleStars = 40;
  
  // Calculate top student's stars to fill the progress track
  const topStars = leaderboard.length > 0 
    ? Math.max(...leaderboard.map((s: any) => s.totalStars)) 
    : 0;

  return (
    <>
      <div className="widget-title">
        Шлях нагород {classInfo && `· ${classInfo.name}`}
      </div>
      
      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", minHeight: "100px", marginTop: "15px" }}>
        {/* Background Track Line (centered from 10% to 90% of width) */}
        <div style={{ 
          position: "absolute", 
          top: "35px", 
          left: "10%", 
          right: "10%", 
          height: "12px", 
          background: "#e9ecef", 
          border: "3px solid #000000",
          borderRadius: "6px"
        }} />

        {/* Filled Progress Line */}
        {topStars > 0 && (
          <div style={{ 
            position: "absolute", 
            top: "35px", 
            left: "10%", 
            width: `calc(${Math.min(100, (topStars / maxScaleStars) * 100)}% * 0.8)`, 
            height: "12px", 
            background: "linear-gradient(90deg, #f59f00 0%, #f08c00 100%)", 
            border: "3px solid #000000",
            borderRight: "none",
            borderRadius: "6px 0 0 6px",
            zIndex: 1
          }} />
        )}

        {/* Milestone Nodes */}
        {REWARDS.map((reward) => {
          const leftPercent = 10 + (reward.stars / maxScaleStars) * 80;
          
          // Calculate percentage of students who reached this
          const totalStudents = leaderboard.length;
          const studentsReached = leaderboard.filter((s: any) => s.totalStars >= reward.stars).length;
          const percentReached = totalStudents > 0 ? Math.round((studentsReached / totalStudents) * 100) : 0;
          
          const isUnlocked = topStars >= reward.stars;

          return (
            <div key={reward.stars} style={{ 
              position: "absolute", 
              left: `${leftPercent}%`,
              top: "16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: "translateX(-50%)",
              zIndex: 2
            }}>
              {/* Reward Emoji circular badge */}
              <div style={{
                width: "40px",
                height: "40px",
                background: isUnlocked ? "#fff3bf" : "#ffffff",
                border: "3px solid #000000",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                boxShadow: isUnlocked ? "0px 3px 0px #000000" : "none",
                marginBottom: "4px",
                transition: "all 0.2s ease"
              }}>
                {reward.emoji}
              </div>

              {/* Stars requirement with StarFilled icon */}
              <div style={{ 
                fontWeight: 900, 
                fontSize: "0.75rem", 
                color: "#000000", 
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                gap: "2px" 
              }}>
                {reward.stars} <StarFilled style={{ color: "var(--color-star, #f59f00)", fontSize: "0.75rem" }} />
              </div>

              {/* Progress percent */}
              <div style={{ fontSize: "0.65rem", color: "#868e96", fontWeight: 600, marginTop: "2px" }}>
                {percentReached}%
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
