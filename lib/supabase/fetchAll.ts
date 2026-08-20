/**
 * Читання ВСІХ рядків запиту посторінково.
 *
 * PostgREST віддає максимум 1000 рядків за запит (`db-max-rows`), і робить це
 * МОВЧКИ — без помилки й без ознаки, що дані обрізано. Для агрегатів це
 * найгірший можливий режим відмови: цифри просто стають меншими за правду,
 * і ніхто цього не помічає, доки клас не виросте.
 *
 * На проді вже 1374 рядки star_entries, тож будь-який «один широкий запит по
 * всіх класах» без пагінації зараз занижував би суми. lib/analytics.ts робив
 * це вручну ще з Етапу 2 — тут той самий прийом, винесений у спільне місце.
 */

const PAGE_SIZE = 1000;

/**
 * Мінімальний структурний тип замість PostgrestFilterBuilder.
 *
 * Дженерики PostgrestFilterBuilder залежать від версії @supabase/postgrest-js
 * і від того, чи типізована схема; спроба назвати їх точно ламає збірку на
 * кожному апгрейді. Нам від білдера потрібен рівно один метод — .range() —
 * тож його і вимагаємо.
 */
interface RangeableQuery<T> {
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * `makeQuery` — ФАБРИКА, а не готовий запит: PostgrestFilterBuilder є
 * одноразовим thenable, повторно виконати той самий об'єкт не можна.
 * Запит має приходити без власного .range().
 */
export async function fetchAllRows<T>(
  makeQuery: () => RangeableQuery<T>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) return all;
    from += PAGE_SIZE;
  }
}
