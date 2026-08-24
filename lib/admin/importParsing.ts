import * as XLSX from "xlsx";

/**
 * Розбір файлу імпорту (CSV/XLSX) — спільний для прев'ю і для запису.
 *
 * Файл парситься ДВІЧІ: один раз для прев'ю (нічого не пишемо, показуємо
 * вчителю «прізвище | ім'я» на підтвердження), другий — при підтвердженні.
 * Це свідомо: Vercel Functions ефемерні, зберігати завантажений файл між
 * запитами ніде, а тримати його в пам'яті між викликами не можна. Двічі
 * розібрати 60 рядків дешевше за будь-яке сховище.
 *
 * Структура стовпців (як у наявних файлах автора):
 *   0: Прізвище Ім'я · 1: сума (ігнорується) · 2: емодзі · 3: нікнейм
 *   4: числовий бонус АБО перший стовпець призу
 *   далі: стовпці призів (True/False), потім стовпці-дати (⭐/⭐⭐/⭐⭐⭐)
 */

export interface ParsedImportRow {
  /** Порядковий номер рядка даних (0-based), стабільний між прев'ю і записом. */
  index: number;
  rawName: string;
  avatarEmoji: string;
  nickname: string | null;
  bonusOffset: number;
  /** Зірки за уроками: дата (YYYY-MM-DD) → кількість. */
  lessonStars: Array<{ date: string; stars: number }>;
}

export interface ParsedImport {
  rows: ParsedImportRow[];
  dateColumnCount: number;
}

function countStars(val: unknown): number {
  if (typeof val === "string") {
    return Array.from(val).filter((c) => c === "⭐").length;
  }
  if (typeof val === "number") return Math.floor(Math.abs(val));
  return 0;
}

function isDateLike(header: unknown): boolean {
  if (header instanceof Date) return true;
  if (typeof header === "number" && header > 40000) return true; // Excel serial
  return false;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseImportWorkbook(buffer: Buffer): ParsedImport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (rows.length < 2) {
    return { rows: [], dateColumnCount: 0 };
  }

  const headers = rows[0] as unknown[];
  const dataRows = rows.slice(1).filter((row) => row[0]);

  const dateColIndices: number[] = [];
  const dateCellDates: Date[] = [];

  for (let i = 4; i < headers.length; i++) {
    const h = headers[i];
    if (!isDateLike(h)) continue;
    dateColIndices.push(i);
    if (h instanceof Date) {
      dateCellDates.push(h);
    } else {
      const d = XLSX.SSF.parse_date_code(h as number);
      dateCellDates.push(new Date(d.y, d.m - 1, d.d));
    }
  }

  const parsed: ParsedImportRow[] = [];

  dataRows.forEach((row, index) => {
    const rawName = String(row[0] ?? "").trim();
    if (!rawName) return;

    const avatarEmoji = String(row[2] ?? "👤").trim() || "👤";
    const nickname = row[3] ? String(row[3]).trim() || null : null;

    let bonusOffset = 0;
    const col4 = row[4];
    if (typeof col4 === "number") {
      bonusOffset = Math.floor(col4);
    } else if (typeof col4 === "string" && /^-?\d+$/.test(col4.trim())) {
      bonusOffset = parseInt(col4.trim(), 10);
    }

    const lessonStars: Array<{ date: string; stars: number }> = [];
    dateColIndices.forEach((colIdx, di) => {
      const stars = countStars(row[colIdx]);
      if (stars === 0) return;
      const d = dateCellDates[di];
      lessonStars.push({ date: d ? toDateString(d) : "2024-01-01", stars });
    });

    parsed.push({ index, rawName, avatarEmoji, nickname, bonusOffset, lessonStars });
  });

  return { rows: parsed, dateColumnCount: dateColIndices.length };
}

/** Перевірка файлу до розбору: розмір і тип. Ліміт той самий, що був. */
export function validateImportFile(file: File): string | null {
  if (file.size > 5 * 1024 * 1024) {
    return "Файл завеликий. Максимум 5 МБ.";
  }
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ];
  const nameOk =
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.name.endsWith(".csv");
  if (!validTypes.includes(file.type) && !nameOk) {
    return "Непідтримуваний тип файлу. Завантажте XLSX або CSV.";
  }
  return null;
}
