import type { SupabaseClient } from "@supabase/supabase-js";

export interface ManagementJournalStudent {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

export interface ManagementJournalLesson {
  id: string;
  date: string;
}

export interface ManagementJournalPrize {
  id: string;
  name: string;
  emoji: string;
}

export interface ManagementJournalData {
  students: ManagementJournalStudent[];
  lessons: ManagementJournalLesson[];
  prizes: ManagementJournalPrize[];
  entries: Record<string, Record<string, number>>;
  givenPrizes: Record<string, Record<string, boolean>>;
  totalStars: Record<string, number>;
}

interface StarEntryRow {
  student_id: string | null;
  lesson_id: string | null;
  amount: number;
  type: string;
}

interface PrizeGivenRow {
  student_id: string;
  prize_id: string;
}

/** Shared by server (SSR) and client ManagementTable — one round-trip batch + prizes_given */
export async function loadManagementJournalData(
  supabase: SupabaseClient,
  classId: string
): Promise<ManagementJournalData> {
  const [
    { data: stData },
    { data: lsData },
    { data: enData },
    { data: przData },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji")
      .eq("class_id", classId)
      .order("full_name"),
    supabase
      .from("lessons")
      .select("id, date")
      .eq("class_id", classId)
      .order("date", { ascending: true }),
    supabase
      .from("star_entries")
      .select("student_id, lesson_id, amount, type")
      .eq("class_id", classId),
    supabase
      .from("prizes_individual")
      .select("id, name, emoji")
      .eq("class_id", classId)
      .order("sort_order"),
  ]);

  const stList = (stData ?? []) as ManagementJournalStudent[];
  const studentIds = stList.map((s) => s.id);
  const lessonList = (lsData ?? []) as ManagementJournalLesson[];
  const prizeList = (przData ?? []) as ManagementJournalPrize[];
  const prizeIds = prizeList.map((p) => p.id);

  let gvData: PrizeGivenRow[] | null = null;
  if (studentIds.length > 0 && prizeIds.length > 0) {
    const { data } = await supabase
      .from("prizes_given")
      .select("student_id, prize_id")
      .in("student_id", studentIds)
      .in("prize_id", prizeIds);
    gvData = data as PrizeGivenRow[] | null;
  }

  const entryMap: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  let classWideBonus = 0;

  const entries = (enData as StarEntryRow[] | null) ?? [];
  
  // First pass: sum class-wide bonuses and individual entries separately
  entries.forEach((e) => {
    if (!e.student_id) {
      classWideBonus += e.amount;
    } else {
      totals[e.student_id] = (totals[e.student_id] ?? 0) + e.amount;
      if (e.type === "lesson" && e.lesson_id) {
        if (!entryMap[e.student_id]) entryMap[e.student_id] = {};
        entryMap[e.student_id][e.lesson_id] = e.amount;
      }
    }
  });

  // Second pass: removed. Class-wide bonus is NOT added to individual totals anymore.

  const givenMap: Record<string, Record<string, boolean>> = {};
  (gvData ?? []).forEach((g) => {
    if (!givenMap[g.student_id]) givenMap[g.student_id] = {};
    givenMap[g.student_id][g.prize_id] = true;
  });

  return {
    students: stList,
    lessons: lessonList,
    prizes: prizeList,
    entries: entryMap,
    givenPrizes: givenMap,
    totalStars: totals,
  };
}
