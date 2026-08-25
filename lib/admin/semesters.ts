import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Семестр — період, на який розрахована програма нагород.
 *
 * Це головна межа продукту: діти працюють, заробляють бали й обмінюють їх на
 * призи РІВНО в межах одного семестру. Коли семестр завершується, клас
 * переходить у наступний (7-А стає 8-А) окремим рядком у `classes`, а старий
 * лишається архівом-історією. Уся механіка переходу — в SQL-функції
 * `roll_over_class` (міграція 038): одна транзакція замість десятка запитів,
 * які можуть впасти посередині.
 *
 * У даних семестр — контейнер класів, як паралель, плюс діапазон дат. Саме
 * тому нічого не треба фільтрувати за датами: бали й уроки вже прив'язані до
 * class_id, а class_id прив'язаний до семестру.
 */

export interface Semester {
  id: string;
  name: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;
  classCount?: number;
}

const SEMESTER_COLS = "id, name, starts_on, ends_on";

/** Семестри вчителя, найновіший зверху. */
export async function loadSemesters(supabase: SupabaseClient): Promise<Semester[]> {
  const { data } = await supabase
    .from("semesters")
    .select(SEMESTER_COLS)
    .is("deleted_at", null)
    .order("starts_on", { ascending: false });
  return (data ?? []) as Semester[];
}

export interface SemesterInput {
  name: string;
  starts_on: string;
  ends_on: string;
}

export async function createSemester(
  supabase: SupabaseClient,
  input: SemesterInput
): Promise<{ id: string | null; error?: string }> {
  const name = input.name.trim();
  if (!name) return { id: null, error: "Вкажіть назву семестру" };
  if (name.length > 80) return { id: null, error: "Занадто довга назва" };
  if (input.ends_on < input.starts_on)
    return { id: null, error: "Кінець семестру раніше за початок" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Сесія завершилась" };

  const { data, error } = await supabase
    .from("semesters")
    .insert({ name, starts_on: input.starts_on, ends_on: input.ends_on, teacher_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return {
      id: null,
      error:
        error?.code === "23505"
          ? "Семестр із такою назвою вже є"
          : error?.message?.includes("Досягнуто ліміт")
          ? "Досягнуто ліміт: не більше 20 семестрів на акаунт"
          : "Не вдалося створити семестр",
    };
  }
  return { id: data.id };
}

/**
 * Який семестр показувати за замовчуванням.
 *
 * Перекриття діапазонів навмисно не заборонені в БД (учитель вільний вести
 * і річний, і семестровий період), тож правило мусить бути детермінованим:
 *   1) той, що триває сьогодні — а якщо таких кілька, той, що почався пізніше;
 *   2) інакше останній, що вже почався (літо між семестрами — показуємо
 *      щойно завершений, а не порожнечу);
 *   3) інакше найближчий майбутній (новий акаунт, семестри створені наперед).
 */
export function pickCurrentSemesterId(
  semesters: Semester[],
  today: string = todayIso()
): string | null {
  if (semesters.length === 0) return null;

  const ongoing = semesters
    .filter((s) => s.starts_on <= today && today <= s.ends_on)
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  if (ongoing.length > 0) return ongoing[0].id;

  const started = semesters
    .filter((s) => s.starts_on <= today)
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  if (started.length > 0) return started[0].id;

  const upcoming = [...semesters].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  return upcoming[0].id;
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** «1 вер. 2026 — 31 груд. 2026» для підпису під назвою семестру. */
export function formatSemesterRange(s: Pick<Semester, "starts_on" | "ends_on">): string {
  return `${formatIsoDate(s.starts_on)} — ${formatIsoDate(s.ends_on)}`;
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

export function semesterStatus(
  s: Pick<Semester, "starts_on" | "ends_on">,
  today: string = todayIso()
): "past" | "current" | "future" {
  if (today < s.starts_on) return "future";
  if (today > s.ends_on) return "past";
  return "current";
}

/**
 * Заготовки для форми створення: чотири найближчі семестри від сьогодні.
 *
 * Українська школа: I семестр — з 1 вересня по 31 грудня, II — з 1 січня по
 * 31 травня. Дати саме заготовки: вчитель міняє їх у формі, бо в кожній школі
 * канікули свої.
 */
export function suggestSemesters(today: string = todayIso()): SemesterInput[] {
  const [year, month] = today.split("-").map(Number);
  // Навчальний рік починається у вересні: до вересня ще триває попередній.
  const schoolYear = month >= 9 ? year : year - 1;

  const build = (start: number): SemesterInput[] => [
    {
      name: `I семестр ${start}/${start + 1}`,
      starts_on: `${start}-09-01`,
      ends_on: `${start}-12-31`,
    },
    {
      name: `II семестр ${start}/${start + 1}`,
      starts_on: `${start + 1}-01-01`,
      ends_on: `${start + 1}-05-31`,
    },
  ];

  return [...build(schoolYear), ...build(schoolYear + 1)];
}

/**
 * Наступна назва класу: 7-А → 8-А, 7А → 8А, 11-Б → 12-Б.
 *
 * Чіпляємось лише за число на початку назви — саме воно й означає рік
 * навчання. Якщо числа немає («ПМ2», «Гурток робототехніки») або клас уже
 * випускний, повертаємо null: майстер тоді просто лишає поле порожнім і
 * вчитель вписує назву сам, замість підставляти дурницю.
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
