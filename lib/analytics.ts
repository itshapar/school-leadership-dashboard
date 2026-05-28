import { SupabaseClient } from "@supabase/supabase-js";

export type TimeFrame = "all_time" | "last_30_days" | "last_7_days";

export async function getDashboardData(supabase: SupabaseClient, classIdFilter?: string | null) {
  // 1. Fetch Classes
  const { data: classes } = await supabase.from("classes").select("*").order("name");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  // 2. Fetch Students
  let studentQuery = supabase.from("students").select("*");
  if (classIdFilter) {
    studentQuery = studentQuery.eq("class_id", classIdFilter);
  }
  const { data: students } = await studentQuery;
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  // 3. Fetch Star Entries (Paginated to retrieve all rows)
  let starEntries: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    let starsQuery = supabase
      .from("star_entries")
      .select("*")
      .range(from, from + limit - 1);
    
    if (classIdFilter) {
      starsQuery = starsQuery.eq("class_id", classIdFilter);
    }
    
    const { data: chunk, error: enError } = await starsQuery;
    if (enError) {
      console.error("Database error in analytics.ts star_entries fetch:", enError);
      throw new Error("Failed to load dashboard data");
    }

    if (chunk && chunk.length > 0) {
      starEntries = starEntries.concat(chunk);
      from += limit;
      if (chunk.length < limit) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

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

  let attendedCount = 0;
  let absenceCount = 0;

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
      if (entry.amount > 0) {
        attendedCount++;
        studentLessons.set(entry.student_id, (studentLessons.get(entry.student_id) ?? 0) + 1);
      } else if (entry.amount === -1) {
        absenceCount++;
      }
    }
  }

  const totalLessonEntries = attendedCount + absenceCount;
  const attendanceRate = totalLessonEntries > 0 ? Math.round((attendedCount / totalLessonEntries) * 100) : 100;

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

  const currentRanking = Array.from(studentMap.values()).sort((a, b) => {
    const starsA = studentStars.get(a.id) ?? 0;
    const starsB = studentStars.get(b.id) ?? 0;
    if (starsB !== starsA) return starsB - starsA;
    return a.full_name.localeCompare(b.full_name, 'uk-UA');
  });

  const pastRanking = Array.from(studentMap.values()).sort((a, b) => {
    const starsA = starsUpToLastWeek.get(a.id) ?? 0;
    const starsB = starsUpToLastWeek.get(b.id) ?? 0;
    if (starsB !== starsA) return starsB - starsA;
    return a.full_name.localeCompare(b.full_name, 'uk-UA');
  });

  // Calculate unique sorted stars for dense ranking
  const sortedUniqueStars = Array.from(new Set(currentRanking.map(s => studentStars.get(s.id) ?? 0))).sort((a, b) => b - a);
  const pastUniqueStars = Array.from(new Set(pastRanking.map(s => starsUpToLastWeek.get(s.id) ?? 0))).sort((a, b) => b - a);

  const leaderboard = currentRanking.map((s) => {
    const totalStars = studentStars.get(s.id) ?? 0;
    const rank = sortedUniqueStars.indexOf(totalStars) + 1;

    const pastStars = starsUpToLastWeek.get(s.id) ?? 0;
    const pastRank = pastUniqueStars.indexOf(pastStars) + 1;
    const trend = pastRank !== 0 ? pastRank - rank : 0; // Gained/lost ranks comparison

    const lessons = studentLessons.get(s.id) ?? 0;
    const efficiency = lessons > 0 ? (totalStars / lessons).toFixed(2) : "0";

    return {
      student: s,
      rank,
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

  // Additional KPIs
  const totalStudents = students?.length ?? 0;
  const totalClassStars = (starEntries ?? []).reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0); // approx
  
  // To get exact total lessons, we should really fetch from lessons table, but let's approximate by unique dates in starEntries of type lesson, or just count maximum lessons attended by any student
  const totalLessons = studentLessons.size > 0 ? Math.max(...Array.from(studentLessons.values())) : 0;

  return {
    classes: classes ?? [],
    students: students ?? [],
    leaderboard,
    topVelocity,
    kpi: {
      bonusesThisMonth: totalBonusesMonth,
      bonusesLastMonth: totalBonusesLastMonth,
      totalStudents,
      totalClassStars,
      totalLessons,
      attendedLessons: attendedCount,
      absencesCount: absenceCount,
      attendanceRate: attendanceRate
    }
  };
}
