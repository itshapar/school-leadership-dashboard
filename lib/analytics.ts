import { SupabaseClient } from "@supabase/supabase-js";

export type TimeFrame = "all_time" | "last_30_days" | "last_7_days";

export async function getDashboardData(supabase: SupabaseClient, classIdFilter?: string | null) {
  // 1. Fetch Classes
  const { data: classes } = await supabase.from("classes").select("*");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  // 2. Fetch Students
  let studentQuery = supabase.from("students").select("*");
  if (classIdFilter) {
    studentQuery = studentQuery.eq("class_id", classIdFilter);
  }
  const { data: students } = await studentQuery;
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  // 3. Fetch Star Entries
  let starsQuery = supabase.from("star_entries").select("*");
  if (classIdFilter) {
    starsQuery = starsQuery.eq("class_id", classIdFilter);
  }
  const { data: starEntries } = await starsQuery;

  // 4. Calculate Basic Stats
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const studentStars = new Map<string, number>();
  const studentStarsLast30 = new Map<string, number>();
  const studentStarsLast7 = new Map<string, number>();
  const studentLessons = new Map<string, number>();

  let totalBonusesMonth = 0;
  let totalBonusesLastMonth = 0;
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  for (const entry of starEntries ?? []) {
    const entryDate = new Date(entry.created_at);
    
    // KPI Stats (Bonuses)
    if (entry.type === "bonus" && entry.amount > 0) {
      if (entryDate >= firstDayOfMonth) {
        totalBonusesMonth += entry.amount;
      } else if (entryDate >= firstDayOfLastMonth && entryDate < firstDayOfMonth) {
        totalBonusesLastMonth += entry.amount;
      }
    }

    if (!entry.student_id) continue;

    // Student Total Stars
    if (entry.amount > 0) {
      studentStars.set(entry.student_id, (studentStars.get(entry.student_id) ?? 0) + entry.amount);
      
      if (entryDate >= thirtyDaysAgo) {
        studentStarsLast30.set(entry.student_id, (studentStarsLast30.get(entry.student_id) ?? 0) + entry.amount);
      }
      if (entryDate >= sevenDaysAgo) {
        studentStarsLast7.set(entry.student_id, (studentStarsLast7.get(entry.student_id) ?? 0) + entry.amount);
      }
    }

    // Student Lessons (for efficiency)
    if (entry.type === "lesson") {
      studentLessons.set(entry.student_id, (studentLessons.get(entry.student_id) ?? 0) + 1);
    }
  }

  // 5. Leaderboard with trends
  // We define "trend" as how many positions they gained/lost compared to last week.
  // To do this simply: rank them by total stars up to today, and rank them by total stars up to 7 days ago.
  const starsUpToLastWeek = new Map<string, number>();
  for (const entry of starEntries ?? []) {
    if (!entry.student_id || entry.amount <= 0) continue;
    const entryDate = new Date(entry.created_at);
    if (entryDate < sevenDaysAgo) {
      starsUpToLastWeek.set(entry.student_id, (starsUpToLastWeek.get(entry.student_id) ?? 0) + entry.amount);
    }
  }

  const currentRanking = Array.from(studentMap.values()).sort((a, b) => (studentStars.get(b.id) ?? 0) - (studentStars.get(a.id) ?? 0));
  const pastRanking = Array.from(studentMap.values()).sort((a, b) => (starsUpToLastWeek.get(b.id) ?? 0) - (starsUpToLastWeek.get(a.id) ?? 0));

  const leaderboard = currentRanking.map((s, index) => {
    const pastIndex = pastRanking.findIndex(p => p.id === s.id);
    const trend = pastIndex !== -1 ? pastIndex - index : 0; // Positive means moved up (e.g. from rank 5 to 2 = +3)
    const lessons = studentLessons.get(s.id) ?? 0;
    const totalStars = studentStars.get(s.id) ?? 0;
    const efficiency = lessons > 0 ? (totalStars / lessons).toFixed(2) : "0";

    return {
      student: s,
      rank: index + 1,
      totalStars,
      starsLast30: studentStarsLast30.get(s.id) ?? 0,
      starsLast7: studentStarsLast7.get(s.id) ?? 0,
      trend,
      lessonsAttended: lessons,
      efficiency: Number(efficiency)
    };
  });

  // 6. Velocity (Breakthrough)
  const velocityLeaderboard = [...leaderboard].sort((a, b) => b.starsLast30 - a.starsLast30);
  const topVelocity = velocityLeaderboard.length > 0 ? velocityLeaderboard[0] : null;

  return {
    classes: classes ?? [],
    students: students ?? [],
    leaderboard,
    topVelocity,
    kpi: {
      bonusesThisMonth: totalBonusesMonth,
      bonusesLastMonth: totalBonusesLastMonth,
    }
  };
}
