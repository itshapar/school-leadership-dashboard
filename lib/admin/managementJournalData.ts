import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadClassGroups,
  loadEntryTypes,
  primaryLessonType,
  type ClassGroup,
  type EntryType,
} from "@/lib/admin/classConfig";

/**
 * Дані журналу класу — спільні для SSR і клієнтського ManagementTable.
 *
 * Етап 6: клітинки уроків фільтруються за `entry_type_id` типу, прив'язаного
 * до уроку (`is_lesson_bound`), а не за enum `type = 'lesson'`. Стовпець
 * `star_entries.type` тут більше не читається взагалі — саме тому 020 може
 * його дропнути.
 */

export interface ManagementJournalStudent {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

export interface ManagementJournalLesson {
  id: string;
  date: string;
}

export interface ManagementJournalPrize {
  id: string;
  name: string;
  emoji: string;
  stars_required: number;
}

export interface ManagementJournalData {
  students: ManagementJournalStudent[];
  lessons: ManagementJournalLesson[];
  prizes: ManagementJournalPrize[];
  groups: ClassGroup[];
  entryTypes: EntryType[];
  /** Тип, яким журнал заповнює клітинки. null → клас без типу для уроків. */
  lessonType: EntryType | null;
  entries: Record<string, Record<string, number>>;
  givenPrizes: Record<string, Record<string, boolean>>;
  totalStars: Record<string, number>;
}

interface StarEntryRow {
  student_id: string | null;
  lesson_id: string | null;
  amount: number;
  entry_type_id: string;
}

interface PrizeGivenRow {
  student_id: string;
  prize_id: string;
}

export async function loadManagementJournalData(
  supabase: SupabaseClient,
  classId: string
): Promise<ManagementJournalData> {
  const [
    { data: stData },
    { data: lsData },
    { data: enData },
    { data: przData },
    entryTypes,
    groups,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, nickname, avatar_emoji, group_id")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("lessons")
      .select("id, date")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("date", { ascending: true }),
    supabase
      .from("star_entries")
      .select("student_id, lesson_id, amount, entry_type_id")
      .eq("class_id", classId),
    supabase
      .from("prizes_individual")
      .select("id, name, emoji, stars_required")
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("sort_order"),
    loadEntryTypes(supabase, classId),
    loadClassGroups(supabase, classId),
  ]);

  const stList = (stData ?? []) as ManagementJournalStudent[];
  const studentIds = stList.map((s) => s.id);
  const lessonList = (lsData ?? []) as ManagementJournalLesson[];
  const prizeList = (przData ?? []) as ManagementJournalPrize[];
  const prizeIds = prizeList.map((p) => p.id);
  const lessonType = primaryLessonType(entryTypes);

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

  const entries = (enData as StarEntryRow[] | null) ?? [];

  entries.forEach((e) => {
    // Класові нарахування (student_id IS NULL) свідомо не додаються до
    // індивідуальних сум — та сама семантика, що на публічному дашборді.
    if (!e.student_id) return;

    if (e.amount > 0) {
      totals[e.student_id] = (totals[e.student_id] ?? 0) + e.amount;
    }

    // Клітинка журналу — лише запис типу, яким журнал і заповнюється.
    if (lessonType && e.entry_type_id === lessonType.id && e.lesson_id) {
      if (!entryMap[e.student_id]) entryMap[e.student_id] = {};
      entryMap[e.student_id][e.lesson_id] = e.amount;
    }
  });

  const givenMap: Record<string, Record<string, boolean>> = {};
  (gvData ?? []).forEach((g) => {
    if (!givenMap[g.student_id]) givenMap[g.student_id] = {};
    givenMap[g.student_id][g.prize_id] = true;
  });

  return {
    students: stList,
    lessons: lessonList,
    prizes: prizeList,
    groups,
    entryTypes,
    lessonType,
    entries: entryMap,
    givenPrizes: givenMap,
    totalStars: totals,
  };
}
