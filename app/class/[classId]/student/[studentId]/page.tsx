import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PersonalDashboardClient from "@/components/PersonalDashboardClient";
import { resolveClassIdByCode } from "@/lib/classCodes";
import { ArrowLeftOutlined } from "@ant-design/icons";

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

  // Fetch all star entries for this student (lessons, individual bonuses/penalties)
  const { data: studentEntries } = await supabase
    .from("star_entries")
    .select("amount, type, note, created_at, lesson_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  // Fetch class-wide bonus entries
  const { data: classEntries } = await supabase
    .from("star_entries")
    .select("amount, type, note, created_at")
    .eq("class_id", classId)
    .is("student_id", null)
    .order("created_at", { ascending: false });

  // Personal stars only
  const personalStars = (studentEntries ?? []).reduce((s, e) => s + e.amount, 0);
  const totalStars = personalStars;

  // History: Personal only
  const history = (studentEntries ?? [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);

  // Prizes Given: Manual checkmarks from admin journal
  const { data: gvData } = await supabase
    .from("prizes_given")
    .select("prize_id")
    .eq("student_id", studentId);
  
  const givenPrizes: Record<string, boolean> = {};
  (gvData ?? []).forEach(g => {
    givenPrizes[g.prize_id] = true;
  });

  // Leaderboard rank (PErsonal ONLY)
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
      starMap[e.student_id] = (starMap[e.student_id] ?? 0) + e.amount;
    }
  }

  const sorted = Object.entries(starMap).sort((a, b) => b[1] - a[1]);
  // Dense ranking: students with equal stars share the same rank
  const myStars = starMap[studentId] ?? 0;
  const rank = sorted.filter(([, stars]) => stars > myStars).length + 1;
  const totalStudentsCount = allStudents?.length || 1;

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
            fontWeight: 800,
            textDecoration: "none",
            background: "#ffffff",
          }}
        >
          ДАШБОРД КЛАСУ
        </Link>
      </div>

      <PersonalDashboardClient
        student={student}
        totalStars={totalStars}
        individualStars={personalStars}
        rank={rank}
        totalStudents={totalStudentsCount}
        prizes={prizes ?? []}
        givenPrizes={givenPrizes}
        history={history}
        classId={classId}
      />
    </div>
  );
}
