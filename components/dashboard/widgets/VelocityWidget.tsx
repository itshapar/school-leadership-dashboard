import StarIcon from "@/components/StarIcon";

export default function VelocityWidget({ topStudent }: any) {
  if (!topStudent || topStudent.starsLast30 === 0) {
    return (
      <>
        <div className="widget-title" style={{ marginBottom: "8px" }}>
          Прорив Місяця
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", color: "#868e96" }}>
          Немає активності
        </div>
      </>
    );
  }

  return (
    <>
      <div className="widget-title" style={{ marginBottom: "8px" }}>
        Прорив Місяця
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>
          {topStudent.student.avatar_emoji}
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#000" }}>
            {topStudent.student.nickname || topStudent.student.full_name.split(" ")[0]}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#e8590c", fontWeight: 800, marginTop: "4px", background: "#fff0f6", padding: "2px 8px", borderRadius: "12px", display: "inline-block" }}>
            +{topStudent.starsLast30} <StarIcon color="currentColor" /> за 30 днів
          </div>
        </div>
      </div>
    </>
  );
}
