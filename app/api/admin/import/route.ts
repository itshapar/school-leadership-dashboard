import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { resolveEntryTypes } from "@/lib/admin/entryTypeResolver";
import { parseImportWorkbook, validateImportFile } from "@/lib/admin/importParsing";
import {
  buildNamePreview,
  normalizeFullName,
  swapNameOrder,
  validateFullName,
  type NamePreviewRow,
} from "@/lib/students/fullName";

/**
 * Імпорт учнів і зірок із CSV/XLSX.
 *
 * ДВА РЕЖИМИ, і це головна зміна Етапу 6:
 *   mode=preview — нічого не пише, повертає розібрані імена як «прізвище | ім'я»
 *                  з позначками підозрілого порядку;
 *   mode=commit  — пише, застосувавши підтверджені вчителем перестановки.
 *
 * Навіщо прев'ю: публічний fallback у БД показує ДРУГЕ слово full_name як
 * ім'я. Файл із порядком «Ім'я Прізвище» тихо виставив би прізвища всіх учнів
 * на публічну сторінку класу. Тому імпорт без підтвердження порядку
 * неможливий — це не UX-люб'язність, а бар'єр.
 *
 * Замість enum star_type пишемо entry_type_id реальних типів цього класу
 * (порожньому класу спершу накочується системний шаблон).
 */

export async function POST(request: NextRequest) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const classId = formData.get("classId") as string | null;
  const mode = (formData.get("mode") as string | null) ?? "preview";

  if (!file || !classId) {
    return NextResponse.json({ error: "Missing file or classId" }, { status: 400 });
  }

  const fileError = validateImportFile(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  // Клас має належати цьому вчителю. Перевірка ДО будь-якого розбору і,
  // головне, до переходу на service-role нижче — той RLS не перевіряє взагалі.
  const claim = await assertClassOwnership(supabaseForRls, classId, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const parsed = parseImportWorkbook(Buffer.from(arrayBuffer));

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "У файлі немає рядків з учнями" }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // Режим прев'ю: показуємо розбір, нічого не чіпаємо.
  // -------------------------------------------------------------------------
  if (mode === "preview") {
    const preview = buildNamePreview(parsed.rows.map((r) => r.rawName));
    return NextResponse.json({
      mode: "preview",
      rows: preview,
      lessonColumns: parsed.dateColumnCount,
      suspiciousCount: preview.filter((r) => r.suspicious).length,
      invalidCount: preview.filter((r) => !r.valid).length,
    });
  }

  if (mode !== "commit") {
    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // Режим запису.
  // -------------------------------------------------------------------------
  let swapIndices: number[] = [];
  const rawSwap = formData.get("swapIndices");
  if (typeof rawSwap === "string" && rawSwap.trim()) {
    try {
      const parsedSwap = JSON.parse(rawSwap);
      if (Array.isArray(parsedSwap)) {
        swapIndices = parsedSwap.filter((n) => Number.isInteger(n));
      }
    } catch {
      return NextResponse.json({ error: "Invalid swapIndices" }, { status: 400 });
    }
  }
  const swapSet = new Set(swapIndices);

  // Імена, які не проходять валідацію, не імпортуються взагалі: краще
  // недоімпортувати і сказати про це, ніж завести учня «Петренко» без імені,
  // у якого публічним іменем стане «Учень».
  const prepared: Array<{
    row: (typeof parsed.rows)[number];
    fullName: string;
  }> = [];
  const skipped: string[] = [];

  for (const row of parsed.rows) {
    const candidate = swapSet.has(row.index)
      ? swapNameOrder(row.rawName)
      : normalizeFullName(row.rawName);
    if (!validateFullName(candidate).ok) {
      skipped.push(row.rawName);
      continue;
    }
    prepared.push({ row, fullName: candidate });
  }

  if (prepared.length === 0) {
    return NextResponse.json(
      { error: "Жоден рядок не пройшов перевірку «прізвище та ім'я»" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient() ?? supabaseForRls;

  const entryTypes = await resolveEntryTypes(supabase, classId);
  if (!entryTypes) {
    return NextResponse.json(
      { error: "У класі немає типів нарахувань, налаштуйте систему балів" },
      { status: 400 }
    );
  }

  // Уроки створюємо один раз на дату, а не на кожного учня.
  const lessonIdByDate = new Map<string, string>();
  const allDates = new Set<string>();
  prepared.forEach(({ row }) => row.lessonStars.forEach((l) => allDates.add(l.date)));

  for (const date of Array.from(allDates)) {
    const { data: existing } = await supabase
      .from("lessons")
      .select("id")
      .eq("class_id", classId)
      .eq("date", date)
      .maybeSingle();

    if (existing) {
      lessonIdByDate.set(date, existing.id);
      continue;
    }
    const { data: created } = await supabase
      .from("lessons")
      .insert({ class_id: classId, date })
      .select("id")
      .single();
    if (created) lessonIdByDate.set(date, created.id);
  }

  let studentsInserted = 0;
  let entriesInserted = 0;
  const errors: string[] = [];

  for (const { row, fullName } of prepared) {
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("full_name", fullName)
      .maybeSingle();

    let studentId: string;
    if (existingStudent) {
      studentId = existingStudent.id;
    } else {
      const { data: newStudent, error: insErr } = await supabase
        .from("students")
        .insert({
          class_id: classId,
          full_name: fullName,
          nickname: row.nickname,
          avatar_emoji: row.avatarEmoji,
        })
        .select("id")
        .single();
      if (insErr || !newStudent) {
        // Прізвище в помилку НЕ кладемо: відповідь API потрапляє в логи.
        errors.push(`Рядок ${row.index + 2}: не вдалося створити учня`);
        continue;
      }
      studentId = newStudent.id;
      studentsInserted++;
    }

    const rows: Array<Record<string, unknown>> = [];

    if (row.bonusOffset !== 0) {
      rows.push({
        student_id: studentId,
        class_id: classId,
        entry_type_id:
          row.bonusOffset > 0 ? entryTypes.positive : entryTypes.negative,
        amount: row.bonusOffset,
        scope: "student",
        note: "Імпортовано: початковий бонус",
      });
    }

    for (const lesson of row.lessonStars) {
      const lessonId = lessonIdByDate.get(lesson.date);
      if (!lessonId) continue;
      rows.push({
        student_id: studentId,
        class_id: classId,
        lesson_id: lessonId,
        entry_type_id: entryTypes.lesson,
        amount: lesson.stars,
        scope: "student",
        note: "Імпортовано",
      });
    }

    if (rows.length === 0) continue;

    // upsert, а не insert: повторний імпорт того самого файлу оновить оцінки,
    // а не подвоїть їх (опора — star_entries_lesson_slot_uq з 025/025a).
    const { error: entriesErr } = await supabase
      .from("star_entries")
      .upsert(rows, { onConflict: "student_id,lesson_id,entry_type_id" });

    if (entriesErr) {
      errors.push(`Рядок ${row.index + 2}: не вдалося зберегти зірки`);
      continue;
    }
    entriesInserted += rows.length;
  }

  const parts = [`Імпортовано: ${studentsInserted} учнів, ${entriesInserted} записів зірок`];
  if (skipped.length) {
    parts.push(`Пропущено рядків без прізвища та імені: ${skipped.length}`);
  }
  if (errors.length) {
    parts.push(errors.join("; "));
  }

  return NextResponse.json({
    mode: "commit",
    message: `✅ ${parts.join(". ")}`,
    studentsInserted,
    entriesInserted,
    skippedCount: skipped.length,
    errors,
  });
}

export type { NamePreviewRow };
