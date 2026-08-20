/**
 * Прізвище та ім'я учня — формат і перевірки (Етап 5, рішення власника).
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║ КРИТИЧНО. Порядок слів має значення для БЕЗПЕКИ, а не для естетики.  ║
 * ║                                                                      ║
 * ║ Публічний fallback Етапу 1 живе в БД:                                ║
 * ║   student_display_name = coalesce(nickname,                          ║
 * ║                                   split_part(full_name, ' ', 2),     ║
 * ║                                   'Учень')                           ║
 * ║ тобто на публічну сторінку класу йде ДРУГЕ СЛОВО.                    ║
 * ║                                                                      ║
 * ║ «Петренко Олександр» → публічно «Олександр» ✅                       ║
 * ║ «Олександр Петренко» → публічно «Петренко» ❌ витік прізвища         ║
 * ║                                                                      ║
 * ║ Тому: плейсхолдер «Прізвище Ім'я», валідація «щонайменше два слова», ║
 * ║ і м'яка перевірка порядку при імпорті з прев'ю на підтвердження.     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * full_name НІКОЛИ не залишає кабінет власника: публічні RPC і учнівський
 * дашборд віддають лише display_name. Цей модуль працює виключно на стороні
 * вчителя.
 */

/** Підказка мінімізації — показується поруч із полем усюди, де вводять учня. */
export const MINIMIZATION_HINT =
  "По батькові, дату народження та інші дані не вносьте — для роботи системи достатньо прізвища та імені.";

export const FULL_NAME_LABEL = "Прізвище та ім'я";
export const FULL_NAME_PLACEHOLDER = "Прізвище Ім'я";
export const FULL_NAME_ORDER_HINT = "Саме в такому порядку: спершу прізвище.";

/** Нагадування про запевнення з розділу 5 Умов — над формами додавання учнів. */
export const DATA_BASIS_REMINDER =
  "Ви підтвердили, що маєте правові підстави вносити дані учнів (розділ 5 Умов). Вносьте лише прізвище та ім'я.";

/** Trim + схлопування будь-яких пробільних послідовностей в один пробіл. */
export function normalizeFullName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function fullNameWords(raw: string | null | undefined): string[] {
  const normalized = normalizeFullName(raw);
  return normalized ? normalized.split(" ") : [];
}

export interface FullNameParts {
  surname: string;
  given: string;
  /** Третє і далі слово: подвійні прізвища, помилково внесене по батькові. */
  rest: string[];
}

/**
 * Розбір «Прізвище Ім'я [решта]».
 *
 * Свідомо НЕ намагаємось «розумно» витягти по батькові з третього слова:
 * система його не зберігає окремо і не потребує — а спроба його розпізнати
 * лише заохотила б вносити зайве.
 */
export function splitFullName(raw: string | null | undefined): FullNameParts {
  const words = fullNameWords(raw);
  return {
    surname: words[0] ?? "",
    given: words[1] ?? "",
    rest: words.slice(2),
  };
}

export interface FullNameValidation {
  ok: boolean;
  error?: string;
}

/** Валідація поля: обов'язкове, щонайменше два слова, розумна довжина. */
export function validateFullName(raw: string | null | undefined): FullNameValidation {
  const normalized = normalizeFullName(raw);
  if (!normalized) {
    return { ok: false, error: "Введіть прізвище та ім'я" };
  }
  if (fullNameWords(normalized).length < 2) {
    return { ok: false, error: "Потрібні два слова: спершу прізвище, потім ім'я" };
  }
  if (normalized.length > 120) {
    return { ok: false, error: "Занадто довго — вносьте лише прізвище та ім'я" };
  }
  return { ok: true };
}

/** Правило для antd Form.Item — та сама перевірка, що й у імпорті. */
export const fullNameRule = {
  validator: (_rule: unknown, value: string) => {
    const result = validateFullName(value);
    return result.ok ? Promise.resolve() : Promise.reject(new Error(result.error));
  },
};

// ---------------------------------------------------------------------------
// М'яка перевірка порядку слів
// ---------------------------------------------------------------------------

/**
 * Поширені українські імена. Список свідомо неповний і використовується ЛИШЕ
 * як підказка: помилка евристики не блокує імпорт, а показує прев'ю на
 * підтвердження. Тому хибне спрацювання коштує вчителю одного погляду,
 * а пропуск — виправляється тим самим прев'ю.
 */
const GIVEN_NAMES = new Set([
  // чоловічі
  "олександр", "андрій", "артем", "богдан", "вадим", "валентин", "валерій",
  "василь", "віктор", "віталій", "владислав", "володимир", "в'ячеслав",
  "гліб", "григорій", "данило", "давид", "дмитро", "євген", "єгор", "захар",
  "іван", "ігор", "ілля", "кирило", "костянтин", "лев", "леонід", "макар",
  "максим", "марк", "марко", "матвій", "микита", "микола", "мирон", "мирослав",
  "михайло", "назар", "олег", "олексій", "орест", "остап", "павло", "петро",
  "роман", "ростислав", "руслан", "святослав", "семен", "сергій", "станіслав",
  "степан", "тарас", "тимофій", "тимур", "юрій", "ярослав", "антон", "аркадій",
  "борис", "денис", "едуард", "філіп", "юліан",
  // жіночі
  "анастасія", "ангеліна", "анна", "аліна", "аліса", "альона", "валентина",
  "валерія", "вікторія", "віра", "владислава", "галина", "ганна", "дарина",
  "діана", "емілія", "єва", "євгенія", "єлизавета", "злата", "інна", "ірина",
  "камілла", "катерина", "ксенія", "лідія", "любов", "людмила", "маргарита",
  "марина", "марія", "мар'яна", "мирослава", "мілана", "надія", "наталія",
  "наталя", "неля", "оксана", "олена", "олеся", "ольга", "поліна", "раїса",
  "роксолана", "світлана", "софія", "соломія", "таїсія", "тетяна", "уляна",
  "христина", "юлія", "яна", "ярослава",
]);

/**
 * Суфікси, характерні саме для прізвищ. Список короткий і консервативний:
 * «Коваль», «Ткач», «Мельник» суфіксів не мають — і це нормально, евристика
 * тоді просто мовчить.
 */
const SURNAME_SUFFIXES = [
  "енко", "енка", "чук", "юк", "ук", "ський", "цький", "зький",
  "ська", "цька", "зька", "ович", "евич", "ишин", "ишина",
  "ов", "ев", "єв", "ін", "ова", "єва", "ева", "іна", "ина",
  "ко", "ик", "як", "ак", "ець", "ій",
];

function looksLikeGivenName(word: string): boolean {
  return GIVEN_NAMES.has(word.toLowerCase().replace(/[’']/g, "'"));
}

function looksLikeSurname(word: string): boolean {
  const w = word.toLowerCase();
  return SURNAME_SUFFIXES.some((suffix) => w.endsWith(suffix));
}

export interface NameOrderCheck {
  /** true → схоже, що вчитель увів «Ім'я Прізвище» замість «Прізвище Ім'я». */
  suspicious: boolean;
  /** Пояснення для прев'ю; порожнє, коли підозри немає. */
  reason: string;
}

/**
 * Чи схоже, що слова переставлені місцями.
 *
 * Підозра виникає лише за СИЛЬНОГО сигналу: перше слово — впізнаване ім'я,
 * а друге ім'ям не є. Слабких сигналів (лише суфікс) для позначки замало —
 * інакше «Ковальчук Марко» (обидва слова із суфіксом «ко») позначалось би
 * щоразу і вчитель перестав би читати попередження.
 */
export function checkNameOrder(raw: string | null | undefined): NameOrderCheck {
  const { surname, given } = splitFullName(raw);
  if (!surname || !given) return { suspicious: false, reason: "" };

  const firstIsGiven = looksLikeGivenName(surname);
  const secondIsGiven = looksLikeGivenName(given);

  if (firstIsGiven && !secondIsGiven) {
    return {
      suspicious: true,
      reason: `«${surname}» схоже на ім'я, а не на прізвище`,
    };
  }

  // Другий сильний сигнал: друге слово має явний суфікс прізвища,
  // а перше — впізнаване ім'я. (Коли обидва — імена, мовчимо.)
  if (firstIsGiven && secondIsGiven && looksLikeSurname(given)) {
    return {
      suspicious: true,
      reason: `«${given}» схоже на прізвище`,
    };
  }

  return { suspicious: false, reason: "" };
}

/** «Олександр Петренко» → «Петренко Олександр». Решта слів лишається в хвості. */
export function swapNameOrder(raw: string | null | undefined): string {
  const { surname, given, rest } = splitFullName(raw);
  if (!surname || !given) return normalizeFullName(raw);
  return [given, surname, ...rest].join(" ");
}

/** Рядок прев'ю імпорту: розібране ім'я + вердикт евристики. */
export interface NamePreviewRow {
  index: number;
  raw: string;
  surname: string;
  given: string;
  rest: string[];
  valid: boolean;
  error?: string;
  suspicious: boolean;
  reason: string;
}

export function buildNamePreview(rawNames: string[]): NamePreviewRow[] {
  return rawNames.map((raw, index) => {
    const normalized = normalizeFullName(raw);
    const parts = splitFullName(normalized);
    const validation = validateFullName(normalized);
    const order = checkNameOrder(normalized);
    return {
      index,
      raw: normalized,
      surname: parts.surname,
      given: parts.given,
      rest: parts.rest,
      valid: validation.ok,
      error: validation.error,
      suspicious: validation.ok && order.suspicious,
      reason: order.reason,
    };
  });
}
