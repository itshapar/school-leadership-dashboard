import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/** Учень у вибірці дашборда — рівно ті поля, які потрібні рейтингу. */
interface StudentRow {
  id: string;
  class_id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

/** Нарахування у вибірці дашборда — лише поля, що беруть участь в агрегатах. */
interface StarEntryRow {
  student_id: string | null;
  amount: number;
  created_at: string;
  entry_type_id: string | null;
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

/** Один клас (classId), кілька класів однієї паралелі (string[]), або все (null/undefined). */
export async function getDashboardData(
  supabase: SupabaseClient,
  classIdFilter?: string | string[] | null
) {
  // 1. Fetch Classes
  //
  // Явний перелік стовпців, а не select("*"): усе, що звідси повертається,
  // серіалізується в RSC-payload і їде в браузер через BentoGrid. select("*")
  // тягнув би legacy_code — старий 4-значний код класу, якому в браузері
  // робити нічого.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, public_code, archived_at, is_demo, parallel_id")
    .is("deleted_at", null)
    // Постійний публічний демо-клас технічно належить цьому акаунту
    // (носій для /demo), але це не реальні дані вчителя — не показуємо
    // його в жодній агрегованій аналітиці.
    .eq("is_public_demo", false)
    // Архівні класи — це завершені семестри. У зведеній аналітиці їм не місце:
    // після переходу класу в новий семестр учні існують двома рядками, і
    // загальні суми рахували б їх двічі. Дашборд окремого архівного класу
    // відкривається як і раніше, за його class_id.
    .is("archived_at", null)
    .order("name");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  // Без явного фільтра (перегляд "усі паралелі / усі класи") — скопуємо
  // студентів і нарахування до класів ІЗ ЦЬОГО Ж (уже без демо-класу)
  // списку, а не до всього, що бачить RLS: інакше картка демо-класу зникає
  // з фільтрів, а його учні й зірки все одно тягнуться в загальні суми.
  const effectiveClassFilter: string | string[] =
    classIdFilter ?? (classes ?? []).map((c) => c.id);

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

  // 2. Fetch Students
  //
  // ДВА виправлення проти попередньої версії, обидва суттєві:
  //
  //  • select("*") тягнув pin_hash / pin_set_at / pin_generation, а рядок
  //    учня далі кладеться в leaderboard як `student: s` і потрапляє в
  //    BentoGrid — клієнтський компонент. Тобто bcrypt-хеші PIN-ів усього
  //    класу їхали в браузер учителя. Це не витік між вчителями (дані
  //    власні), але хешам у браузері робити нічого. Тепер — явний перелік.
  //
  //  • не було фільтра deleted_at (його додала міграція 018, аналітику не
  //    оновили), тож видалений учень лишався в рейтингу й у сумах.
  //
  // Посторінково: до 20 класів × 60 учнів = 1200 рядків, а PostgREST мовчки
  // віддає максимум 1000.
  const students = await fetchAllRows<StudentRow>(() => {
    const q = supabase
      .from("students")
      .select("id, class_id, full_name, nickname, avatar_emoji, group_id")
      .is("deleted_at", null);
    return Array.isArray(effectiveClassFilter)
      ? q.in("class_id", effectiveClassFilter)
      : q.eq("class_id", effectiveClassFilter);
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 3. Fetch Star Entries
  //
  // Лише ті стовпці, які тут справді рахуються. Раніше було select("*"), що
  // тягнуло ще й `note` — нотатки вчителя до нарахувань — для 1374 рядків,
  // хоча агрегати їх не використовують. Заразом це знімає залежність від
  // стовпця `type`, який дропає міграція 020.
  const starEntries = await fetchAllRows<StarEntryRow>(() => {
    const q = supabase
      .from("star_entries")
      .select("student_id, amount, created_at, entry_type_id");
    return Array.isArray(effectiveClassFilter)
      ? q.in("class_id", effectiveClassFilter)
      : q.eq("class_id", effectiveClassFilter);
  });

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

  for (const entry of starEntries) {
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
  for (const entry of starEntries) {
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
  const totalClassStars = starEntries.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0); // approx
  
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
