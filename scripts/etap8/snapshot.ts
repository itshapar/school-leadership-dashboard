/**
 * Знімок стану даних до/після міграції 020 (Етап 8, вимога 2).
 *
 * Запуск:
 *   npx tsx scripts/etap8/snapshot.ts before   → docs/etap8/snapshot-before.json
 *   npx tsx scripts/etap8/snapshot.ts after    → docs/etap8/snapshot-after.json + діф
 *
 * Що фіксує:
 *   • глобальні лічильники (класи, учні, уроки, нарахування, сума балів);
 *   • по кожному класу: кількість записів, суму балів, конфігурацію типів
 *     і призів із порогами;
 *   • по кожному учню: сумарні зірки.
 *
 * Останнє — найсильніша перевірка: якщо 020 зачепить дані, сума хоч в одного
 * учня зміниться, навіть коли класові підсумки випадково зійдуться.
 *
 * У знімку НЕМАЄ персональних даних: лише UUID-и, назви класів і числа.
 * Тому файл безпечно комітити в репозиторій як доказ звірки.
 *
 * Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY у .env.local:
 * знімок мусить бачити ВСЕ, зокрема soft-deleted, інакше він не помітить, що
 * міграція щось приховала.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT_DIR = path.join(ROOT, "docs/etap8");

const PAGE = 1000;

interface Snapshot {
  takenAt: string;
  phase: string;
  totals: Record<string, number>;
  classes: ClassSnapshot[];
  studentStars: Record<string, number>;
}

interface ClassSnapshot {
  id: string;
  name: string;
  public_code: string;
  legacy_code: string | null;
  students: number;
  lessons: number;
  entries: number;
  sumAmount: number;
  sumPositive: number;
  entryTypes: string[];
  classPrizes: string[];
  individualPrizes: string[];
}

async function rest<T>(query: string): Promise<T[]> {
  // Посторінково: PostgREST мовчки ріже видачу на 1000 рядків, а знімок,
  // який тихо недорахував, гірший за відсутність знімка.
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${URL_BASE}/rest/v1/${query}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`${query} → HTTP ${res.status}: ${await res.text()}`);
    const chunk = (await res.json()) as T[];
    out.push(...chunk);
    if (chunk.length < PAGE) return out;
  }
}

async function takeSnapshot(phase: string): Promise<Snapshot> {
  const [classes, students, lessons, entries, types, classPrizes, indPrizes] =
    await Promise.all([
      rest<{ id: string; name: string; public_code: string; legacy_code: string | null }>(
        "classes?select=id,name,public_code,legacy_code&order=name"
      ),
      rest<{ id: string; class_id: string }>("students?select=id,class_id"),
      rest<{ id: string; class_id: string }>("lessons?select=id,class_id"),
      rest<{ class_id: string; student_id: string | null; amount: number }>(
        "star_entries?select=class_id,student_id,amount"
      ),
      rest<{ class_id: string; name: string; sign: number; default_amount: number }>(
        "entry_types?select=class_id,name,sign,default_amount&order=sort_order"
      ),
      rest<{ class_id: string; name: string; threshold: number }>(
        "class_prizes?select=class_id,name,threshold&order=sort_order"
      ),
      rest<{ class_id: string; name: string; stars_required: number }>(
        "prizes_individual?select=class_id,name,stars_required&order=sort_order"
      ),
    ]);

  const byClass = <T extends { class_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    rows.forEach((r) => m.set(r.class_id, [...(m.get(r.class_id) ?? []), r]));
    return m;
  };

  const studentsByClass = byClass(students);
  const lessonsByClass = byClass(lessons);
  const entriesByClass = byClass(entries);
  const typesByClass = byClass(types);
  const clsPrizesByClass = byClass(classPrizes);
  const indPrizesByClass = byClass(indPrizes);

  const studentStars: Record<string, number> = {};
  entries.forEach((e) => {
    if (!e.student_id) return;
    studentStars[e.student_id] = (studentStars[e.student_id] ?? 0) + e.amount;
  });

  const classSnapshots: ClassSnapshot[] = classes.map((c) => {
    const own = entriesByClass.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name,
      public_code: c.public_code,
      legacy_code: c.legacy_code,
      students: (studentsByClass.get(c.id) ?? []).length,
      lessons: (lessonsByClass.get(c.id) ?? []).length,
      entries: own.length,
      sumAmount: own.reduce((s, e) => s + e.amount, 0),
      sumPositive: own.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0),
      // Конфігурацію фіксуємо рядками «назва:значення» — так діф одразу
      // показує, ЩО саме змінилось, а не просто «кількість інша».
      entryTypes: (typesByClass.get(c.id) ?? []).map(
        (t) => `${t.name}:${t.sign > 0 ? "+" : "-"}${t.default_amount}`
      ),
      classPrizes: (clsPrizesByClass.get(c.id) ?? []).map(
        (p) => `${p.name}:${p.threshold}`
      ),
      individualPrizes: (indPrizesByClass.get(c.id) ?? []).map(
        (p) => `${p.name}:${p.stars_required}`
      ),
    };
  });

  return {
    takenAt: new Date().toISOString(),
    phase,
    totals: {
      classes: classes.length,
      students: students.length,
      lessons: lessons.length,
      entries: entries.length,
      sumAmount: entries.reduce((s, e) => s + e.amount, 0),
    },
    classes: classSnapshots,
    studentStars,
  };
}

/** Порівняння двох знімків. Повертає список розбіжностей (порожній = OK). */
function diff(before: Snapshot, after: Snapshot): string[] {
  const problems: string[] = [];

  for (const key of Object.keys(before.totals)) {
    if (before.totals[key] !== after.totals[key]) {
      problems.push(`totals.${key}: було ${before.totals[key]} → стало ${after.totals[key]}`);
    }
  }

  const afterById = new Map(after.classes.map((c) => [c.id, c]));
  for (const b of before.classes) {
    const a = afterById.get(b.id);
    if (!a) {
      problems.push(`клас «${b.name}» зник`);
      continue;
    }
    const scalar: Array<keyof ClassSnapshot> = [
      "students", "lessons", "entries", "sumAmount", "sumPositive", "public_code",
    ];
    for (const f of scalar) {
      if (a[f] !== b[f]) {
        problems.push(`клас «${b.name}» · ${String(f)}: було ${b[f]} → стало ${a[f]}`);
      }
    }
    const lists: Array<keyof ClassSnapshot> = [
      "entryTypes", "classPrizes", "individualPrizes",
    ];
    for (const f of lists) {
      const bv = (b[f] as string[]).join(" | ");
      const av = (a[f] as string[]).join(" | ");
      if (bv !== av) {
        problems.push(`клас «${b.name}» · ${String(f)}:\n      було:  ${bv}\n      стало: ${av}`);
      }
    }
  }

  for (const [studentId, stars] of Object.entries(before.studentStars)) {
    const now = after.studentStars[studentId];
    if (now === undefined) {
      problems.push(`учень ${studentId} зник із нарахувань (було ${stars})`);
    } else if (now !== stars) {
      problems.push(`учень ${studentId}: було ${stars} → стало ${now}`);
    }
  }

  return problems;
}

async function main() {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") {
    console.error("Використання: npx tsx scripts/etap8/snapshot.ts before|after");
    process.exit(2);
  }
  if (!URL_BASE || !KEY) {
    console.error("Немає NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY у .env.local");
    process.exit(2);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const snapshot = await takeSnapshot(phase);
  const file = path.join(OUT_DIR, `snapshot-${phase}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");

  console.log(`\n📸 Знімок «${phase}» збережено: ${path.relative(ROOT, file)}`);
  console.log(
    `   класів ${snapshot.totals.classes} · учнів ${snapshot.totals.students} · ` +
      `уроків ${snapshot.totals.lessons} · нарахувань ${snapshot.totals.entries} · ` +
      `сума ${snapshot.totals.sumAmount}`
  );

  if (phase === "before") {
    console.log("\nТепер застосуй 020, потім запусти:  npx tsx scripts/etap8/snapshot.ts after\n");
    return;
  }

  const beforeFile = path.join(OUT_DIR, "snapshot-before.json");
  if (!fs.existsSync(beforeFile)) {
    console.error("\n❌ Немає snapshot-before.json — нема з чим порівнювати.\n");
    process.exit(2);
  }

  const before = JSON.parse(fs.readFileSync(beforeFile, "utf-8")) as Snapshot;
  const problems = diff(before, snapshot);

  console.log(`\n🔍 Звірка зі знімком від ${before.takenAt}`);
  if (problems.length === 0) {
    console.log("\n✅ Розбіжностей немає. Дані пережили 020 без втрат.\n");
    process.exit(0);
  }

  console.log(`\n❌ Розбіжностей: ${problems.length}\n`);
  problems.forEach((p) => console.log(`   • ${p}`));
  console.log("\n   → див. план відкату в docs/etap8/RUNBOOK.md\n");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
