import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClassProgressBars from "@/components/ClassProgress";
import { resolveClassIdByCode } from "@/lib/classCodes";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function ClassPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();
  const isUuidLike = /^[0-9a-f-]{36}$/i.test(classParam);
  let resolvedClassId = classParam;

  if (!isUuidLike) {
    const { data: allClasses } = await supabase.from("classes").select("id");
    const byCode = resolveClassIdByCode(allClasses ?? [], classParam);
    if (!byCode) return notFound();
    resolvedClassId = byCode;
  }

  const { data: cls } = await supabase.from("classes").select("*").eq("id", resolvedClassId).maybeSingle();

  if (!cls) return notFound();
  const classId = resolvedClassId;

  // Fetch students with their total stars
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji")
    .eq("class_id", classId);

  // Fetch all star entries for this class
  const { data: starEntries } = await supabase
    .from("star_entries")
    .select("student_id, amount")
    .eq("class_id", classId)
    .not("student_id", "is", null);

  // Fetch class-wide entries (whole class bonuses)
  const { data: classEntries } = await supabase
    .from("star_entries")
    .select("amount")
    .eq("class_id", classId)
    .is("student_id", null);

  // Calculate per-student totals
  const starMap: Record<string, number> = {};
  for (const entry of starEntries ?? []) {
    if (entry.student_id) {
      starMap[entry.student_id] = (starMap[entry.student_id] ?? 0) + entry.amount;
    }
  }

  // Add class-wide bonuses to every student
  const classBonus = (classEntries ?? []).reduce((sum, e) => sum + e.amount, 0);

  const ranked = (students ?? [])
    .map((s) => ({
      ...s,
      stars: (starMap[s.id] ?? 0) + classBonus,
    }))
    .sort((a, b) => b.stars - a.stars);

  const totalClassStars = ranked.reduce((s, r) => s + r.stars, 0);

  return (
    <div className="page-container">
      <div style={{ marginBottom: "24px" }} />

      <div className="page-header">
        <h1>{cls.name}</h1>
        <div
          style={{
            display: "inline-block",
            marginTop: "8px",
            padding: "10px 16px",
            border: "2px solid var(--color-border)",
            borderRadius: "12px",
            fontSize: "1.05rem",
            fontWeight: 800,
            background: "#ffffff",
          }}
        >
          {totalClassStars}
        </div>
      </div>

      {/* Class prize progress */}
      <div className="star-card" style={{ marginBottom: "24px" }}>
        <div style={{ fontWeight: 800, marginBottom: "20px", fontSize: "1.1rem", textTransform: "uppercase" }}>
          Прогрес нагород класу
        </div>
        <ClassProgressBars
          totalStars={totalClassStars}
          gameDayThreshold={cls.game_day_threshold}
          pizzaDayThreshold={cls.pizza_day_threshold}
        />
      </div>

      {/* Leaderboard */}
      <div className="star-card" style={{ padding: "24px 16px" }}>
        {ranked.map((student, idx) => {
          const rank = idx + 1;
          const displayName = student.nickname || student.full_name.split(" ")[0];
          return (
            <Link
              key={student.id}
              href={`/class/${classParam}/student/${student.id}`}
              style={{ textDecoration: "none" }}
            >
              <div className={`leaderboard-row rank-${rank <= 3 ? rank : ""}`}>
                <div className={`rank-badge rank-${rank <= 3 ? rank : ""}`}>{rank}</div>
                <div style={{ fontSize: "1.8rem" }}>{student.avatar_emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#000000" }}>{displayName}</div>
                  {student.nickname && (
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                      {student.full_name}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "1.2rem",
                    color: "var(--color-text)",
                  }}
                >
                  {student.stars}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
