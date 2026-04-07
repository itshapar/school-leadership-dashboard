import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";

// Column structure per the spec:
// col 0: full_name
// col 1: total_stars (formula result — validation only)
// col 2: avatar_emoji
// col 3: nickname
// col 4: bonus_offset (numeric) OR 'Кіндер' prize column
// Then: prize columns (True/False)
// Then: date columns (datetime → star strings ⭐⭐⭐)

function countStars(val: unknown): number {
  if (typeof val === "string") {
    // Count ⭐ characters
    const count = Array.from(val).filter((c) => c === "⭐").length;
    return count;
  }
  if (typeof val === "number") return Math.floor(Math.abs(val));
  return 0;
}

function isDateLike(header: unknown): boolean {
  if (header instanceof Date) return true;
  if (typeof header === "number" && header > 40000) return true; // Excel date serial
  return false;
}

export async function POST(request: NextRequest) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient() ?? supabaseForRls;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const classId = formData.get("classId") as string | null;

  if (!file || !classId) {
    return NextResponse.json({ error: "Missing file or classId" }, { status: 400 });
  }

  // File size and type validation
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });
  }

  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
    "application/vnd.ms-excel",
    "text/csv"
  ];
  if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
    return NextResponse.json({ error: "Invalid file type. Please upload an Excel or CSV file." }, { status: 400 });
  }

  // Verify class ownership via RLS
  const { data: classData } = await supabaseForRls
    .from("classes")
    .select("id")
    .eq("id", classId)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Unauthorized to import into this class." }, { status: 403 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });

  if (rows.length < 2) {
    return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
  }

  const headers = rows[0] as unknown[];
  const dataRows = rows.slice(1).filter((row) => row[0]); // Skip empty rows

  // Identify date columns (index ≥ 4)
  const dateColIndices: number[] = [];
  const dateCellDates: Date[] = [];

  for (let i = 4; i < headers.length; i++) {
    const h = headers[i];
    if (isDateLike(h)) {
      dateColIndices.push(i);
      if (h instanceof Date) {
        dateCellDates.push(h);
      } else if (typeof h === "number") {
        // Excel serial date to JS Date
        const d = XLSX.SSF.parse_date_code(h);
        dateCellDates.push(new Date(d.y, d.m - 1, d.d));
      }
    }
  }

  let studentsInserted = 0;
  let entriesInserted = 0;
  const errors: string[] = [];

  for (const row of dataRows) {
    const fullName = String(row[0] ?? "").trim();
    if (!fullName) continue;

    const avatarEmoji = String(row[2] ?? "⭐").trim() || "⭐";
    const nickname = row[3] ? String(row[3]).trim() : null;

    // Bonus offset (col 4 if numeric)
    let bonusOffset = 0;
    const col4 = row[4];
    if (typeof col4 === "number") {
      bonusOffset = Math.floor(col4);
    } else if (typeof col4 === "string" && /^-?\d+$/.test(col4.trim())) {
      bonusOffset = parseInt(col4.trim(), 10);
    }

    // Upsert student
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
        .insert({ class_id: classId, full_name: fullName, nickname, avatar_emoji: avatarEmoji })
        .select("id")
        .single();
      if (insErr || !newStudent) {
        errors.push(`Failed to insert student: ${fullName}`);
        continue;
      }
      studentId = newStudent.id;
      studentsInserted++;
    }

    // Insert bonus offset as a 'bonus' entry if non-zero
    if (bonusOffset !== 0) {
      await supabase.from("star_entries").insert({
        student_id: studentId,
        class_id: classId,
        type: bonusOffset > 0 ? "bonus" : "penalty",
        amount: bonusOffset,
        note: "Імпортовано: початковий бонус",
      });
      entriesInserted++;
    }

    // Insert star entries for each date column
    for (let di = 0; di < dateColIndices.length; di++) {
      const colIdx = dateColIndices[di];
      const cellVal = row[colIdx];
      const stars = countStars(cellVal);
      if (stars === 0) continue;

      const lessonDate = dateCellDates[di];
      const dateStr = lessonDate
        ? `${lessonDate.getFullYear()}-${String(lessonDate.getMonth() + 1).padStart(2, "0")}-${String(lessonDate.getDate()).padStart(2, "0")}`
        : "2024-01-01";

      // Upsert lesson for this date
      const { data: existingLesson } = await supabase
        .from("lessons")
        .select("id")
        .eq("class_id", classId)
        .eq("date", dateStr)
        .maybeSingle();

      let lessonId: string;
      if (existingLesson) {
        lessonId = existingLesson.id;
      } else {
        const { data: newLesson } = await supabase
          .from("lessons")
          .insert({ class_id: classId, date: dateStr })
          .select("id")
          .single();
        lessonId = newLesson?.id ?? "";
      }

      await supabase.from("star_entries").insert({
        student_id: studentId,
        class_id: classId,
        lesson_id: lessonId || null,
        type: "lesson",
        amount: stars,
        note: "Імпортовано",
      });
      entriesInserted++;
    }
  }

  return NextResponse.json({
    message: `✅ Імпортовано: ${studentsInserted} учнів, ${entriesInserted} записів зірок${errors.length ? `. Помилки: ${errors.join("; ")}` : ""}`,
    studentsInserted,
    entriesInserted,
    errors,
  });
}
