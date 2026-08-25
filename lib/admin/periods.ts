/**
 * Період = семестр навчального року. ВБУДОВАНИЙ КАЛЕНДАР, а не налаштування.
 *
 * Семестр у школі не заводять, він настає. Тому тут немає ні таблиці, ні
 * форми створення, ні назв: період — це код `YYYY-N`, де YYYY — рік початку
 * навчального року, а N — номер семестру. '2026-1' читається як «I семестр
 * 2026/2027».
 *
 * Межі (рішення Andrew, 2026-08-25): навчальний рік триває з 1 СЕРПНЯ по
 * 31 липня.
 *   I семестр  — 1 серпня Y     … 31 грудня Y
 *   II семестр — 1 січня Y+1    … 31 липня Y+1
 * Серпень свідомо в I семестрі, а не в порожнечі між роками: саме в серпні
 * вчитель готує класи на новий рік.
 *
 * Коди фіксованої ширини, тому їх можна порівнювати рядково:
 * '2025-1' < '2025-2' < '2026-1'. Цим користуються і фронтенд, і SQL-функція
 * roll_over_class (міграція 039), яка так перевіряє «тільки вперед».
 *
 * Ті самі правила продубльовані в БД функціями public.period_of і
 * public.period_start — не заради краси, а тому що заборона «не можна в
 * семестр, який ще не настав» мусить стояти в базі, а не тільки в інтерфейсі.
 */

export type PeriodCode = string;

export const PERIOD_RE = /^20\d{2}-[12]$/;

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidPeriod(code: string | null | undefined): code is PeriodCode {
  return typeof code === "string" && PERIOD_RE.test(code);
}

export function periodCode(yearStart: number, index: 1 | 2): PeriodCode {
  return `${yearStart}-${index}`;
}

export function yearStartOf(code: PeriodCode): number {
  return Number(code.slice(0, 4));
}

export function semesterIndex(code: PeriodCode): 1 | 2 {
  return code.endsWith("2") ? 2 : 1;
}

/** Період, у якому лежить дата. Серпень і далі — вже новий навчальний рік. */
export function periodOf(iso: string = todayIso()): PeriodCode {
  const [year, month] = iso.split("-").map(Number);
  return month >= 8 ? periodCode(year, 1) : periodCode(year - 1, 2);
}

export function currentPeriod(today: string = todayIso()): PeriodCode {
  return periodOf(today);
}

export function nextPeriod(code: PeriodCode): PeriodCode {
  const year = yearStartOf(code);
  return semesterIndex(code) === 1 ? periodCode(year, 2) : periodCode(year + 1, 1);
}

export function periodStartIso(code: PeriodCode): string {
  const year = yearStartOf(code);
  return semesterIndex(code) === 1 ? `${year}-08-01` : `${year + 1}-01-01`;
}

export function periodEndIso(code: PeriodCode): string {
  const year = yearStartOf(code);
  return semesterIndex(code) === 1 ? `${year}-12-31` : `${year + 1}-07-31`;
}

export function isPeriodStarted(code: PeriodCode, today: string = todayIso()): boolean {
  return periodStartIso(code) <= today;
}

/**
 * Чи доступний період цьому вчителю.
 *
 * Два правила, обидва з живого фідбеку: період не можна відкрити наперед, і
 * період до приходу вчителя в застосунок йому не потрібен. Той, хто
 * зареєструвався в січні 2027, починає з II семестру 2026/2027, а не з
 * порожніх семестрів, у яких його ще не було.
 */
export function isPeriodAvailable(
  code: PeriodCode,
  firstPeriod: PeriodCode,
  today: string = todayIso()
): boolean {
  return code >= firstPeriod && isPeriodStarted(code, today);
}

/**
 * Навчальні роки для табів: від першого доступного вчителю до наступного за
 * поточним. Наступний показуємо навмисно вимкненим — щоб було видно, що далі
 * буде, і коли саме воно відкриється.
 */
export function listYearStarts(
  firstPeriod: PeriodCode,
  today: string = todayIso()
): number[] {
  const from = yearStartOf(firstPeriod);
  const to = yearStartOf(currentPeriod(today)) + 1;
  const years: number[] = [];
  for (let y = from; y <= to; y += 1) years.push(y);
  return years;
}

export function schoolYearLabel(yearStart: number): string {
  return `${yearStart}/${yearStart + 1}`;
}

export function periodLabel(code: PeriodCode): string {
  return semesterIndex(code) === 1 ? "I семестр" : "II семестр";
}

export function periodFullLabel(code: PeriodCode): string {
  return `${periodLabel(code)} ${schoolYearLabel(yearStartOf(code))}`;
}

const MONTHS_GENITIVE = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_GENITIVE[m - 1]} ${y}`;
}

export function periodRangeLabel(code: PeriodCode): string {
  return `${formatIsoDate(periodStartIso(code))} — ${formatIsoDate(periodEndIso(code))}`;
}

/** «Стане доступним 1 січня 2027» — підказка на вимкненому табі. */
export function periodOpensLabel(code: PeriodCode): string {
  return `Стане доступним ${formatIsoDate(periodStartIso(code))}`;
}

export function periodStatus(
  code: PeriodCode,
  today: string = todayIso()
): "past" | "current" | "future" {
  if (today < periodStartIso(code)) return "future";
  if (today > periodEndIso(code)) return "past";
  return "current";
}

/**
 * Перший період, доступний вчителю: той, у якому він зареєструвався. Якщо
 * класи чомусь давніші за акаунт (перенесені дані, сіди), береться
 * найраніший період із класів — інакше вчитель просто не побачив би власні
 * класи.
 */
export function firstAvailablePeriod(
  registeredAtIso: string | null | undefined,
  classPeriods: PeriodCode[]
): PeriodCode {
  const fromAccount = registeredAtIso ? periodOf(registeredAtIso.slice(0, 10)) : currentPeriod();
  const earliestClass = classPeriods.filter(isValidPeriod).sort()[0];
  return earliestClass && earliestClass < fromAccount ? earliestClass : fromAccount;
}
