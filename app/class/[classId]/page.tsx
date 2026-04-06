import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClassProgressBars from "@/components/ClassProgress";
import { resolveClassIdByCode } from "@/lib/classCodes";
import { StarFilled } from "@ant-design/icons";

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

  // Calculate per-student totals (personal stars only)
  const starMap: Record<string, number> = {};
  for (const entry of starEntries ?? []) {
    if (entry.student_id && entry.amount > 0) {
      starMap[entry.student_id] = (starMap[entry.student_id] ?? 0) + entry.amount;
    }
  }

  // Calculate global class bonus/penalty
  const classBonus = (classEntries ?? []).reduce((sum, e) => sum + e.amount, 0);

  // Alphabetical sorting (A-Z) by full_name
  const sortedAlphabetically = (students ?? [])
    .map((s) => ({
      ...s,
      stars: starMap[s.id] ?? 0,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'uk-UA'));

  // Dense ranking (Still calculated for underlying data/total, but not used for sorting display)
  const ranked = sortedAlphabetically.map((s) => ({
    ...s,
    rank: sortedAlphabetically.filter((o) => o.stars > s.stars).length + 1,
  }));

  // Total class progress: sum of individual efforts + the class pool
  const totalPersonalStars = ranked.reduce((s, r) => s + r.stars, 0);
  const totalClassStars = totalPersonalStars + classBonus;

  return (
    <div className="page-container">
      <div style={{ marginBottom: "24px" }} />

      <div className="page-header">
        <h1 style={{ fontSize: "2.8rem", fontWeight: 900 }}>{cls.name}</h1>
      </div>

      {/* Total Class Stars Counter (Prominent) */}
      <div className="star-card" style={{ 
        textAlign: "center", 
        marginBottom: "24px", 
        padding: "32px",
        background: "#ffffff",
        border: "3px solid #000000",
        boxShadow: "4px 4px 0px #000000"
      }}>
        <div style={{ fontSize: "5rem", fontWeight: 950, color: "var(--color-star)", lineHeight: 1, letterSpacing: "-2px" }}>
          {totalClassStars} <StarFilled style={{ fontSize: "3.5rem", verticalAlign: "middle", marginTop: "-10px" }} />
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

      {/* Collective History Card */}
      {(classBonus !== 0 || (classEntries ?? []).length > 0) && (
        <div className="star-card" style={{ 
          marginBottom: "24px", 
          background: "#ffffff", 
          border: "3px solid #000000",
          boxShadow: "4px 4px 0px #000000"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase" }}>
              Колективні бонуси та штрафи
            </div>
            <div style={{ 
              fontSize: "1.5rem", 
              fontWeight: 950, 
              color: classBonus < 0 ? "#E03131" : "var(--color-star)",
              padding: "4px 12px",
              background: "#fff",
              borderRadius: "8px",
              border: "2px solid #000",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              {classBonus > 0 ? "+" : ""}{classBonus} <StarFilled style={{ fontSize: "1.1rem" }} />
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(classEntries ?? []).slice(0, 5).map((entry: any, idx: number) => (
              <div key={idx} style={{ 
                fontSize: "0.95rem", 
                color: "var(--color-text)", 
                fontWeight: 700, 
                display: "flex", 
                justifyContent: "space-between",
                padding: "8px 12px",
                background: entry.amount < 0 ? "#FFF5F5" : "#F8F9FA",
                border: "2px solid #000",
                borderRadius: "8px"
              }}>
                <span>{entry.note || (entry.amount > 0 ? "Бонус класу" : "Штраф класу")}</span>
                <span style={{ color: entry.amount < 0 ? "#E03131" : "var(--color-star)" }}>
                  {entry.amount > 0 ? "+" : ""}{entry.amount}
                </span>
              </div>
            ))}
            {(classEntries ?? []).length > 5 && (
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "center", fontStyle: "italic" }}>
                та ще {(classEntries ?? []).length - 5} записів...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student List (Alphabetical, No Stars) */}
      <div className="star-card" style={{ padding: "24px 16px" }}>
        {ranked.map((student) => {
          return (
            <Link
              key={student.id}
              href={`/class/${classParam}/student/${student.id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="leaderboard-row">
                <div style={{ fontSize: "1.8rem" }}>{student.avatar_emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 850, fontSize: "1.1rem", color: "#000000" }}>
                    {student.nickname || student.full_name}
                  </div>
                  {student.nickname && (
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>
                      {student.full_name}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
