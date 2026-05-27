import { X, Award, MapPin } from "lucide-react";
import React, { useEffect } from "react";

const REWARDS = [
  { stars: 10, name: "Kinder", emoji: "🍬" },
  { stars: 20, name: "Stickers", emoji: "🎨" },
  { stars: 30, name: "Piny", emoji: "📌" },
  { stars: 40, name: "3D-print", emoji: "🤖" },
];

export default function StudentModal({ student, onClose }: any) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const earnedRewards = REWARDS.filter(r => student.totalStars >= r.stars);
  const nextReward = REWARDS.find(r => student.totalStars < r.stars);

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }} onClick={onClose}>
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "400px",
        border: "4px solid #000",
        boxShadow: "8px 8px 0px #000",
        position: "relative",
        overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} style={{
          position: "absolute", top: "16px", right: "16px",
          background: "transparent", border: "none", cursor: "pointer",
          padding: "4px"
        }}>
          <X size={24} />
        </button>

        {/* Header */}
        <div style={{ background: "#f8f9fa", padding: "32px 24px", textAlign: "center", borderBottom: "4px solid #000" }}>
          <div style={{ fontSize: "5rem", lineHeight: 1, marginBottom: "16px" }}>
            {student.student.avatar_emoji}
          </div>
          <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900 }}>
            {student.student.nickname || student.student.full_name}
          </h2>
          <div style={{ color: "#868e96", fontWeight: 700, marginTop: "4px" }}>
            {student.student.full_name}
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div style={{ background: "#fff9db", padding: "16px", borderRadius: "12px", border: "2px solid #000", textAlign: "center" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>Зірки</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#f59f00" }}>{student.totalStars} ⭐</div>
            </div>
            <div style={{ background: "#e3fafc", padding: "16px", borderRadius: "12px", border: "2px solid #000", textAlign: "center" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>Ефективність</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#1098ad" }}>{student.efficiency}</div>
            </div>
          </div>

          {/* Rewards Inventory */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "1.1rem", marginBottom: "12px" }}>
              <Award size={20} color="#e03131" />
              Інвентар Нагород
            </div>
            
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {earnedRewards.length > 0 ? earnedRewards.map(r => (
                <div key={r.stars} style={{
                  padding: "8px 12px", background: "#f1f3f5", borderRadius: "8px", border: "2px solid #000",
                  display: "flex", alignItems: "center", gap: "8px", fontWeight: 700
                }}>
                  <span style={{ fontSize: "1.2rem" }}>{r.emoji}</span> {r.name}
                </div>
              )) : (
                <div style={{ color: "#868e96", fontSize: "0.9rem", fontWeight: 600 }}>Поки немає нагород</div>
              )}
            </div>
          </div>

          {nextReward && (
            <div style={{ marginTop: "24px", padding: "16px", background: "#f8f9fa", borderRadius: "12px", border: "2px solid #e9ecef" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#868e96", marginBottom: "4px" }}>Наступна ціль</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{nextReward.emoji} {nextReward.name}</span>
                <span style={{ fontWeight: 800, color: "#f59f00" }}>{nextReward.stars - student.totalStars} ⭐ лишилось</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
