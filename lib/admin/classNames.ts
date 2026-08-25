/**
 * Підказки назв при переході класу в наступний семестр.
 *
 * Живуть окремо від календаря (lib/admin/periods.ts) навмисно: це не про
 * час, а про те, як школа називає класи, і правило тут суто мовне.
 */

/**
 * Наступна назва класу: 7-А → 8-А, 7А → 8А, 11-Б → 12-Б.
 *
 * Чіпляємось лише за число на початку назви — саме воно й означає рік
 * навчання. Якщо числа немає («ПМ2», «Гурток робототехніки») або клас уже
 * випускний, повертаємо null: майстер тоді лишає поле порожнім і вчитель
 * вписує назву сам, замість підставляти дурницю.
 */
export function nextClassName(name: string): string | null {
  const match = name.trim().match(/^(\d{1,2})(\D.*)?$/);
  if (!match) return null;
  const grade = Number(match[1]);
  if (!Number.isFinite(grade) || grade < 1 || grade >= 12) return null;
  return `${grade + 1}${match[2] ?? ""}`;
}

/** Наступна паралель: «7» → «8». Той самий діапазон 1–12, що в майстрі. */
export function nextParallelName(name: string): string | null {
  const grade = Number(name.trim());
  if (!Number.isFinite(grade) || grade < 1 || grade >= 12) return null;
  return String(grade + 1);
}
