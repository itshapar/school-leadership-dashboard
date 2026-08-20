import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/** Учень у вибірці дашборда: select("*"), але потрібні лише ці поля. */
interface StudentRow {
  id: string;
  class_id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

/** Класовий приз у тому вигляді, в якому його показують віджети дашборда. */
export interface ClassPrizeLite {
  id: string;
  class_id: string;
  name: string;
  emoji: string;
  threshold: number;
  sort_order: number;
}

export type TimeFrame = "all_time" | "last_30_days" | "last_7_days";

export async function getDashboardData(supabase: SupabaseClient, classIdFilter?: string | null) {
  // 1. Fetch Classes
  const { data: classes } = await supabase.from("classes").select("*").order("name");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  // 1b. Класові призи — джерело правди для «Епічних цілей» замість двох
  // зашитих стовпців classes.game_day_threshold / pizza_day_threshold.
  const { data: classPrizes } = await supabase
    .from("class_prizes")
    .select("id, class_id, name, emoji, threshold, sort_order")
    .is("deleted_at", null)
    .order("sort_order");

  const prizesByClass = new Map<string, ClassPrizeLite[]>();
  (classPrizes ?? []).forEach((p) => {
    const list = prizesByClass.get(p.class_id) ?? [];
    list.push(p as ClassPrizeLite);
    prizesByClass.set(p.class_id, list);
  });

  // 1c. Типи нарахувань: замінюють enum star_type. Семантика, від якої
  // залежить аналітика, тепер властивість типу, а не магічний рядок:
  //   «урок»  = is_lesson_bound
  //   «бонус» = НЕ прив'язаний до уроку і додатний
  const { data: entryTypeRows } = await supabase
    .from("entry_types")
    .select("id, class_id, is_lesson_bound, sign");

  const typeById = new Map<string, { is_lesson_bound: boolean; sign: number }>(
    (entryTypeRows ?? []).map((t) => [
      t.id as string,
      { is_lesson_bound: Boolean(t.is_lesson_bound), sign: Number(t.sign) },
    ])
  );

  const isLessonEntry = (entryTypeId: string | null) =>
    entryTypeId ? typeById.get(entryTypeId)?.is_lesson_bound === true : false;
  const isBonusEntry = (entryTypeId: string | null) =>
    entryTypeId ? typeById.get(entryTypeId)?.is_lesson_bound === false : false;

  // 2. Fetch Students (посторінково: до 20 класів × 60 учнів = 1200 рядків,
  // а PostgREST мовчки віддає максимум 1000)
  const students = await fetchAllRows<StudentRow>(() => {
    const q = supabase.from("students").select("*");
    return classIdFilter ? q.eq("class_id", classIdFilter) : q;
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

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
    if (isBonusEntry(entry.entry_type_id) && entry.amount > 0) {
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
    if (isLessonEntry(entry.entry_type_id)) {
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
    classes: (classes ?? []).map((c) => ({
      ...c,
      class_prizes: prizesByClass.get(c.id) ?? [],
    })),
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
