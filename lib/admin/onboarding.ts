import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/**
 * Прогрес майстра онбордингу (PRD §5.2).
 *
 * Ключове рішення: прогрес НЕ зберігається окремо — він ВИВОДИТЬСЯ з
 * фактичного стану БД. Причини:
 *  • переживає зміну пристрою, вкладки і вихід із акаунта;
 *  • не може розійтися з реальністю (не буває «крок виконано», коли учнів
 *    насправді немає — і навпаки);
 *  • не потребує ані нової колонки, ані localStorage.
 *
 * Кожен крок можна пропустити: майстер не блокує перехід, а лише показує,
 * що лишилось. «Незавершений» клас видно в кабінеті бейджем «Налаштувати».
 */

export const ONBOARDING_STEPS = [
  { key: "class", title: "Клас" },
  { key: "students", title: "Учні" },
  { key: "scoring", title: "Бали" },
  { key: "prizes", title: "Нагороди" },
  { key: "codes", title: "Коди" },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export interface OnboardingProgress {
  classId: string;
  done: Record<OnboardingStepKey, boolean>;
  doneCount: number;
  totalSteps: number;
  complete: boolean;
  /** Перший невиконаний крок — саме на нього повертає бейдж «Налаштувати». */
  nextStep: OnboardingStepKey;
}

const TOTAL = ONBOARDING_STEPS.length;

function tally(rows: Array<{ class_id: string }> | null): Map<string, number> {
  const map = new Map<string, number>();
  (rows ?? []).forEach((r) => map.set(r.class_id, (map.get(r.class_id) ?? 0) + 1));
  return map;
}

/**
 * Прогрес одразу для списку класів: по одному широкому запиту на сутність
 * і зведення в пам'яті, а не N×5 запитів із кабінету.
 *
 * Крок «Коди» вважається виконаним, коли хоча б одному учню згенеровано PIN
 * (`pin_hash IS NOT NULL`). Сам PIN у відкритому вигляді ніде не зберігається
 * (Етап 4), тому це єдиний спостережуваний слід роздачі.
 */
export async function getOnboardingProgressBatch(
  supabase: SupabaseClient,
  classIds: string[]
): Promise<Map<string, OnboardingProgress>> {
  const result = new Map<string, OnboardingProgress>();
  if (classIds.length === 0) return result;

  // Учнів у 20 класах може бути до 1200 — більше за стелю PostgREST у 1000
  // рядків, тому саме цей запит іде посторінково. Решта сутностей обмежені
  // лімітами 30/30/30 на клас, тобто максимум 600 рядків.
  const [studentRows, typesRes, indivRes, clsPrizeRes] = await Promise.all([
    fetchAllRows<{ class_id: string; pin_hash: string | null }>(() =>
      supabase
        .from("students")
        .select("class_id, pin_hash")
        .in("class_id", classIds)
        .is("deleted_at", null)
    ),
    supabase
      .from("entry_types")
      .select("class_id")
      .in("class_id", classIds)
      .is("deleted_at", null),
    supabase
      .from("prizes_individual")
      .select("class_id")
      .in("class_id", classIds)
      .is("deleted_at", null),
    supabase
      .from("class_prizes")
      .select("class_id")
      .in("class_id", classIds)
      .is("deleted_at", null),
  ]);

  const studentCount = new Map<string, number>();
  const pinCount = new Map<string, number>();
  studentRows.forEach((r) => {
    studentCount.set(r.class_id, (studentCount.get(r.class_id) ?? 0) + 1);
    if (r.pin_hash) pinCount.set(r.class_id, (pinCount.get(r.class_id) ?? 0) + 1);
  });

  const typeCount = tally(typesRes.data as Array<{ class_id: string }> | null);
  const indivCount = tally(indivRes.data as Array<{ class_id: string }> | null);
  const clsPrizeCount = tally(clsPrizeRes.data as Array<{ class_id: string }> | null);

  classIds.forEach((classId) => {
    const done: Record<OnboardingStepKey, boolean> = {
      class: true, // клас існує, інакше його не було б у списку
      students: (studentCount.get(classId) ?? 0) > 0,
      scoring: (typeCount.get(classId) ?? 0) > 0,
      prizes: (indivCount.get(classId) ?? 0) + (clsPrizeCount.get(classId) ?? 0) > 0,
      codes: (pinCount.get(classId) ?? 0) > 0,
    };
    const doneCount = Object.values(done).filter(Boolean).length;
    result.set(classId, {
      classId,
      done,
      doneCount,
      totalSteps: TOTAL,
      complete: doneCount === TOTAL,
      nextStep: ONBOARDING_STEPS.find((s) => !done[s.key])?.key ?? "codes",
    });
  });

  return result;
}

/** Прогрес одного класу — той самий підрахунок, зручніша сигнатура. */
export async function getOnboardingProgress(
  supabase: SupabaseClient,
  classId: string
): Promise<OnboardingProgress> {
  const batch = await getOnboardingProgressBatch(supabase, [classId]);
  return (
    batch.get(classId) ?? {
      classId,
      done: { class: true, students: false, scoring: false, prizes: false, codes: false },
      doneCount: 1,
      totalSteps: TOTAL,
      complete: false,
      nextStep: "students",
    }
  );
}
