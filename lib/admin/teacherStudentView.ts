import type { SupabaseClient } from "@supabase/supabase-js";
import { splitFullName } from "@/lib/students/fullName";

/**
 * Дашборд одного учня очима ВЧИТЕЛЯ (живий фідбек: із журналу й рейтингу
 * хочеться відкрити конкретного учня й побачити те саме, що бачить він).
 *
 * Чому не переюзано публічний RPC: `public_student_dashboard` навмисно
 * відкликаний і в anon, і в authenticated (міграція 035, дірка Етапу 9.12),
 * а `student_dashboard_by_session` вимагає токен сесії учня, якого у
 * вчителя немає й бути не повинно. Тому дані збираємо звичайними
 * запитами під RLS самого вчителя: він і так має доступ до своїх класів,
 * а чужий клас поверне порожньо, бо RLS не віддасть жодного рядка.
 *
 * Форма даних свідомо повторює PublicStudentDashboard, щоб малювати той
 * самий PersonalDashboardClient без окремої гілки в компоненті.
 */

export interface TeacherStudentView {
  classId: string;
  className: string;
  classCode: string;
  student: {
    id: string;
    /** ПІБ, видиме лише вчителю. */
    fullName: string;
    /** Те саме публічне ім'я, що бачить сам учень. */
    displayName: string;
    nickname: string | null;
    avatarEmoji: string;
  };
  totalStars: number;
  rank: number;
  totalStudents: number;
  prizes: Array<{
    id: string;
    name: string;
    emoji: string;
    stars_required: number;
    sort_order: number;
  }>;
  givenPrizeIds: string[];
  history: Array<{
    amount: number;
    type_name: string | null;
    type_icon: string | null;
    note: string | null;
    created_at: string;
  }>;
}

interface EntryRow {
  student_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
  entry_type_id: string;
}

export async function loadTeacherStudentView(
  supabase: SupabaseClient,
  studentId: string
): Promise<TeacherStudentView | null> {
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, nickname, avatar_emoji, class_id")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!student) return null;

  const classId = student.class_id as string;

  const [{ data: cls }, { data: classmates }, { data: entries }, { data: prizes }, { data: entryTypes }] =
    await Promise.all([
      supabase.from("classes").select("id, name, public_code").eq("id", classId).maybeSingle(),
      supabase
        .from("students")
        .select("id")
        .eq("class_id", classId)
        .is("deleted_at", null),
      supabase
        .from("star_entries")
        .select("student_id, amount, note, created_at, entry_type_id")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from("prizes_individual")
        .select("id, name, emoji, stars_required, sort_order")
        .eq("class_id", classId)
        .is("deleted_at", null)
        .order("sort_order"),
      supabase.from("entry_types").select("id, name, icon").eq("class_id", classId),
    ]);

  if (!cls) return null;

  const typeById = new Map(
    (entryTypes ?? []).map((t) => [t.id as string, { name: t.name as string, icon: t.icon as string | null }])
  );

  // Та сама семантика, що й у журналі та на публічному дашборді: у суму
  // йдуть лише додатні індивідуальні нарахування, класові (student_id
  // IS NULL) не рахуються особистими.
  const totals = new Map<string, number>();
  const rows = (entries ?? []) as EntryRow[];
  rows.forEach((e) => {
    if (!e.student_id || e.amount <= 0) return;
    totals.set(e.student_id, (totals.get(e.student_id) ?? 0) + e.amount);
  });

  const totalStars = totals.get(studentId) ?? 0;
  let ahead = 0;
  totals.forEach((sum, id) => {
    if (id !== studentId && sum > totalStars) ahead += 1;
  });
  const rank = ahead + 1;

  const prizeIds = (prizes ?? []).map((p) => p.id as string);
  let givenPrizeIds: string[] = [];
  if (prizeIds.length > 0) {
    const { data: given } = await supabase
      .from("prizes_given")
      .select("prize_id")
      .eq("student_id", studentId)
      .in("prize_id", prizeIds);
    givenPrizeIds = (given ?? []).map((g) => g.prize_id as string);
  }

  const fullName = student.full_name as string;
  const nickname = (student.nickname as string | null) ?? null;

  return {
    classId,
    className: cls.name as string,
    classCode: cls.public_code as string,
    student: {
      id: student.id as string,
      fullName,
      // Публічно учень підписаний нікнеймом, а без нього — ім'ям (другим
      // словом ПІБ). Повторюємо те саме правило, що й student_display_name
      // у БД, щоб вчитель бачив рівно те, що бачать однокласники.
      displayName: nickname || splitFullName(fullName).given || fullName,
      nickname,
      avatarEmoji: (student.avatar_emoji as string) ?? "👤",
    },
    totalStars,
    rank,
    totalStudents: (classmates ?? []).length,
    prizes: (prizes ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      emoji: p.emoji as string,
      stars_required: p.stars_required as number,
      sort_order: (p.sort_order as number) ?? 0,
    })),
    givenPrizeIds,
    history: rows
      .filter((e) => e.student_id === studentId)
      .slice(0, 50)
      .map((e) => ({
        amount: e.amount,
        type_name: typeById.get(e.entry_type_id)?.name ?? null,
        type_icon: typeById.get(e.entry_type_id)?.icon ?? null,
        note: e.note,
        created_at: e.created_at,
      })),
  };
}
