import { Map } from "lucide-react";

const REWARDS = [
  { stars: 10, name: "Kinder", emoji: "🍬" },
  { stars: 20, name: "Stickers", emoji: "🎨" },
  { stars: 30, name: "Piny", emoji: "📌" },
  { stars: 40, name: "3D-print", emoji: "🤖" },
];

export default function LootRoadWidget({ leaderboard, classInfo }: any) {
  const maxStars = 40;
  
  return (
    <>
      <div className="widget-title">
        <Map size={20} color="#228be6" />
        Loot Road {classInfo && `- ${classInfo.name}`}
      </div>
      
      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", padding: "0 20px" }}>
        {/* Background Line */}
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "20px", 
          right: "20px", 
          height: "8px", 
          background: "#e9ecef", 
          borderRadius: "4px",
          transform: "translateY(-50%)"
        }} />

        {/* Nodes */}
        {REWARDS.map((reward, index) => {
          const leftPercent = (reward.stars / maxStars) * 100;
          
          // Calculate percentage of students who reached this
          const totalStudents = leaderboard.length;
          const studentsReached = leaderboard.filter((s: any) => s.totalStars >= reward.stars).length;
          const percentReached = totalStudents > 0 ? Math.round((studentsReached / totalStudents) * 100) : 0;
          
          const isEpic = index === REWARDS.length - 1;

          return (
            <div key={reward.stars} style={{ 
              position: "absolute", 
              left: `calc(${leftPercent}% - 20px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: "translateX(-50%)",
              zIndex: 2
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                background: isEpic ? "#ffd43b" : "#fff",
                border: `3px solid ${isEpic ? "#f59f00" : "#000"}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                boxShadow: isEpic ? "0 0 15px rgba(245, 159, 0, 0.5)" : "none",
                marginBottom: "8px"
              }}>
                {reward.emoji}
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                {reward.stars} ⭐
              </div>
              <div style={{ fontSize: "0.75rem", color: "#868e96", fontWeight: 700 }}>
                {percentReached}%
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
