import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { getOnboardingProgressBatch } from "@/lib/admin/onboarding";
import { loadParallels, type Parallel } from "@/lib/admin/parallels";
import {
  loadManagementJournalData,
  type ManagementJournalData,
} from "@/lib/admin/managementJournalData";
import { formatClassCode, normalizeClassCode } from "@/lib/classCodes";
import type { PeriodCode } from "@/lib/admin/periods";
import type { AdminClassCard } from "@/components/Admin/AdminClassList";

/**
 * Дані для демо-кабінету: той самий інтерфейс, що бачить зареєстрований
 * учитель, але на синтетичному класі й без логіну.
 *
 * Читаємо службовим ключем, бо анонімний відвідувач не має (і не повинен
 * мати) права читати students, lessons чи star_entries під RLS. Ключ живе
 * тільки на сервері й у браузер не потрапляє, а кожен запит тут жорстко
 * звужений до класу з is_public_demo = true: інші класи цими функціями не
 * дістати навіть підставивши чужий код.
 */

export interface DemoClassRow {
  id: string;
  name: string;
  public_code: string;
  parallel_id: string | null;
  period_code: string;
  archived_at: string | null;
  is_demo: boolean | null;
}

const DEMO_SELECT = "id, name, public_code, parallel_id, period_code, archived_at, is_demo";

/** Усі публічні демо-класи (зараз один, але список не заважає). */
export async function getDemoClasses(): Promise<DemoClassRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("classes")
    .select(DEMO_SELECT)
    .eq("is_public_demo", true)
    .is("deleted_at", null)
    .order("name");

  return (data ?? []) as DemoClassRow[];
}

/** Демо-клас за публічним кодом. Не демо, значить null. */
export async function getDemoClassByCode(rawCode: string): Promise<DemoClassRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("classes")
    .select(DEMO_SELECT)
    .eq("public_code", normalizeClassCode(rawCode))
    .eq("is_public_demo", true)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as DemoClassRow | null) ?? null;
}

export interface DemoCabinet {
  cards: AdminClassCard[];
  parallels: Parallel[];
  firstPeriod: PeriodCode;
}

/**
 * Кабінет: ті самі картки класів, що на /admin. Рахунки збираються тим самим
 * способом, що й там (див. app/admin/page.tsx), щоб демо не розходилось із
 * реальним кабінетом у дрібницях.
 */
export async function getDemoCabinet(): Promise<DemoCabinet | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const classes = await getDemoClasses();
  if (classes.length === 0) return null;

  const classIds = classes.map((c) => c.id);

  const [parallels, progressByClass, students, lessons, entries] = await Promise.all([
    loadParallels(admin),
    getOnboardingProgressBatch(admin, classIds),
    fetchAllRows<{ class_id: string }>(() =>
      admin.from("students").select("id, class_id").in("class_id", classIds).is("deleted_at", null)
    ),
    fetchAllRows<{ class_id: string }>(() =>
      admin.from("lessons").select("id, class_id").in("class_id", classIds).is("deleted_at", null)
    ),
    fetchAllRows<{ class_id: string; student_id: string | null; amount: number }>(() =>
      admin.from("star_entries").select("class_id, student_id, amount").in("class_id", classIds)
    ),
  ]);

  const countBy = (rows: Array<{ class_id: string }>) => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.class_id, (map.get(r.class_id) ?? 0) + 1));
    return map;
  };

  const studentCounts = countBy(students);
  const lessonCounts = countBy(lessons);

  const starTotals = new Map<string, number>();
  entries.forEach((e) => {
    const delta = e.student_id ? (e.amount > 0 ? e.amount : 0) : e.amount;
    starTotals.set(e.class_id, (starTotals.get(e.class_id) ?? 0) + delta);
  });

  const cards: AdminClassCard[] = classes.map((cls) => ({
    id: cls.id,
    name: cls.name,
    public_code: cls.public_code,
    formatted_code: formatClassCode(cls.public_code),
    parallel_id: cls.parallel_id,
    period_code: cls.period_code as PeriodCode,
    archived: Boolean(cls.archived_at),
    is_demo: cls.is_demo ?? false,
    studentCount: studentCounts.get(cls.id) ?? 0,
    lessonCount: lessonCounts.get(cls.id) ?? 0,
    totalStars: starTotals.get(cls.id) ?? 0,
    onboardingDone: progressByClass.get(cls.id)?.doneCount ?? 5,
    onboardingTotal: progressByClass.get(cls.id)?.totalSteps ?? 5,
    onboardingComplete: progressByClass.get(cls.id)?.complete ?? true,
    nextStep: progressByClass.get(cls.id)?.nextStep ?? "class",
  }));

  // Роки в демо починаються з періоду самого класу: показувати гостю
  // порожні семестри, яких він не застав, немає сенсу.
  const firstPeriod = cards
    .map((c) => c.period_code)
    .sort()[0] as PeriodCode;

  return { cards, parallels, firstPeriod };
}

/** Дані журналу демо-класу для ManagementTable. */
export async function getDemoJournal(
  classId: string
): Promise<ManagementJournalData | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return loadManagementJournalData(admin, classId);
}

/** Учні демо-класу для тулбару журналу. */
export async function getDemoStudents(classId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("students")
    .select("id, full_name, nickname, avatar_emoji, group_id")
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("full_name");
  return data ?? [];
}
