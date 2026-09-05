/**
 * Порядок нагород у всьому інтерфейсі: від найдешевшої до найдорожчої.
 *
 * У БД нагороди лежать у порядку створення (`sort_order`), і саме так вони
 * і показувалися. Для учня це нечитабельно: він шукає найближчу мету, а не
 * ту, яку вчитель завів першою. Тому і в таблиці вчителя, і на дашбордах
 * (індивідуальні нагороди й нагороди всього класу) сортуємо за вартістю.
 *
 * Поріг зберігається в різних стовпцях (`stars_required` в індивідуальних,
 * `threshold` у класових), тож вартість передається аксесором. Сортування
 * стабільне, тому нагороди з однаковою ціною лишаються в порядку вчителя.
 */
export function sortPrizesByCost<T>(prizes: readonly T[], cost: (prize: T) => number): T[] {
  return [...prizes].sort((a, b) => cost(a) - cost(b));
}

/** Індивідуальні нагороди (поріг — `stars_required`). */
export function sortIndividualPrizes<T extends { stars_required: number }>(
  prizes: readonly T[]
): T[] {
  return sortPrizesByCost(prizes, (p) => p.stars_required);
}

/** Нагороди всього класу (поріг — `threshold`). */
export function sortClassPrizes<T extends { threshold: number }>(prizes: readonly T[]): T[] {
  return sortPrizesByCost(prizes, (p) => p.threshold);
}
