import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PersonalDashboardClient from "@/components/PersonalDashboardClient";
import { resolveClassIdByCode } from "@/lib/classCodes";

interface Props {
  params: Promise<{ classId: string; studentId: string }>;
}

export default async function StudentDashboardPage({ params }: Props) {
  const { classId: classParam, studentId } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch student
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji, class_id")
    .eq("id", studentId)
    .single();

  if (!student) return notFound();

  const isUuidLike = /^[0-9a-f-]{36}$/i.test(classParam);
  let resolvedClassId = classParam;
  if (!isUuidLike) {
    const { data: allClasses } = await supabase.from("classes").select("id");
    const byCode = resolveClassIdByCode(allClasses ?? [], classParam);
    if (!byCode) return notFound();
    resolvedClassId = byCode;
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, game_day_threshold, pizza_day_threshold")
    .eq("id", resolvedClassId)
    .maybeSingle();

  if (!cls) return notFound();
  const classId = resolvedClassId;

  // Fetch prizes for this class
  const { data: prizes } = await supabase
    .from("prizes_individual")
    .select("id, name, emoji, stars_required, sort_order")
    .eq("class_id", classId)
    .order("sort_order");

  // Fetch all star entries for this student
  const { data: studentEntries } = await supabase
    .from("star_entries")
    .select("amount, type, note, created_at, lesson_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  // Fetch class-wide bonus entries
  const { data: classEntries } = await supabase
    .from("star_entries")
    .select("amount")
    .eq("class_id", classId)
    .is("student_id", null);

  // Total stars
  const personalStars = (studentEntries ?? []).reduce((s, e) => s + e.amount, 0);
  const classBonus = (classEntries ?? []).reduce((s, e) => s + e.amount, 0);
  const totalStars = personalStars + classBonus;

  // Leaderboard rank
  const { data: allStudents } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId);

  const { data: allEntries } = await supabase
    .from("star_entries")
    .select("student_id, amount")
    .eq("class_id", classId)
    .not("student_id", "is", null);

  const starMap: Record<string, number> = {};
  for (const e of allEntries ?? []) {
    if (e.student_id) {
      starMap[e.student_id] = (starMap[e.student_id] ?? 0) + e.amount + classBonus;
    }
  }
  // Ensure this student is present even if 0 personal stars
  starMap[studentId] = starMap[studentId] ?? classBonus;

  const sorted = Object.entries(starMap).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([id]) => id === studentId) + 1;
  const totalStudents = allStudents?.length ?? 1;

  // Last 5 lesson entries
  const last5 = (studentEntries ?? [])
    .filter((e) => e.type === "lesson")
    .slice(0, 5);

  return (
    <div className="page-container">
      <div style={{ marginBottom: "8px" }}>
        <Link
          href={`/class/${classParam}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            padding: "10px 16px",
            border: "2px solid var(--color-border)",
            borderRadius: "10px",
            color: "var(--color-text)",
            fontSize: "1rem",
            fontWeight: 700,
            textDecoration: "none",
            background: "#ffffff",
          }}
        >
          ← {cls.name}
        </Link>
      </div>

      <PersonalDashboardClient
        student={student}
        totalStars={totalStars}
        individualStars={personalStars}
        rank={rank}
        totalStudents={totalStudents}
        prizes={prizes ?? []}
        last5Lessons={last5}
        classId={classId}
      />
    </div>
  );
}
