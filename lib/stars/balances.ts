import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/**
 * Скільки зірок у учня та у класу — єдине місце, звідки це читає фронтенд.
 *
 * Саме правило живе в БД, у в'юхах `student_star_balances` і
 * `class_star_balances` (міграція 049), а не тут. Два роки поспіль кожна
 * сторінка рахувала суму сама, рядком `amount > 0`, і саме тому штрафи
 * ніде не віднімалися: правило було скопійоване в сім місць, а виправляли
 * його в нуль з них. Тепер обидві тонкощі — «Н» у журналі не штраф, і
 * баланс не падає нижче нуля — описані один раз у SQL.
 *
 * RLS не втрачається: в'юхи створені з security_invoker, тож під сесією
 * вчителя видно рівно ті класи, що й у самій star_entries.
 */

interface StudentBalanceRow {
  class_id: string;
  student_id: string;
  stars: number;
}

interface ClassBalanceRow {
  class_id: string;
  stars: number;
}

/**
 * Баланси учнів: `student_id → зірки`.
 *
 * `classIds === null` — усі класи, доступні поточній сесії (звужує RLS);
 * порожній масив — свідомо порожній результат, без зайвого запиту.
 */
export async function loadStudentStarBalances(
  supabase: SupabaseClient,
  classIds: string[] | null = null
): Promise<Map<string, number>> {
  if (classIds && classIds.length === 0) return new Map();

  const rows = await fetchAllRows<StudentBalanceRow>(() => {
    const q = supabase.from("student_star_balances").select("class_id, student_id, stars");
    return classIds ? q.in("class_id", classIds) : q;
  });

  return new Map(rows.map((r) => [r.student_id, r.stars]));
}

/**
 * Сума балансів учнів у розрізі класів: `class_id → зірки`.
 *
 * Групуємо за class_id із самої в'юхи, а не через список учнів: інакше
 * підсумок картки класу розійшовся б із `personal_stars` публічного RPC,
 * який рахує всі нарахування класу.
 */
export async function loadStudentStarTotalsByClass(
  supabase: SupabaseClient,
  classIds: string[] | null = null
): Promise<Map<string, number>> {
  if (classIds && classIds.length === 0) return new Map();

  const rows = await fetchAllRows<StudentBalanceRow>(() => {
    const q = supabase.from("student_star_balances").select("class_id, student_id, stars");
    return classIds ? q.in("class_id", classIds) : q;
  });

  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.class_id, (totals.get(r.class_id) ?? 0) + r.stars));
  return totals;
}

/** Баланси класових нарахувань: `class_id → зірки`. */
export async function loadClassStarBalances(
  supabase: SupabaseClient,
  classIds: string[] | null = null
): Promise<Map<string, number>> {
  if (classIds && classIds.length === 0) return new Map();

  const rows = await fetchAllRows<ClassBalanceRow>(() => {
    const q = supabase.from("class_star_balances").select("class_id, stars");
    return classIds ? q.in("class_id", classIds) : q;
  });

  return new Map(rows.map((r) => [r.class_id, r.stars]));
}
