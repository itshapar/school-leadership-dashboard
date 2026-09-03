import { NextResponse } from "next/server";
// Trigger redeploy
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { uuidLike } from "@/lib/validation/uuid";
import { isValidPeriod, periodEndIso, periodRangeLabel, periodStartIso } from "@/lib/admin/periods";

const PostLessonSchema = z
  .object({
    class_id: uuidLike,
    date: z.string().date().optional(),
    // Серія уроків (Етап 9.2): за розкладом днів тижня, а не по одному вручну.
    dates: z.array(z.string().date()).min(1).max(200).optional(),
  })
  .refine((v) => v.date || (v.dates && v.dates.length > 0), {
    message: "date or dates required",
  });

const DeleteLessonSchema = z.object({
  id: z.string(),
});

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PostLessonSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { class_id } = body;
  const dates = body.dates ?? [body.date!];

  // Клас має належати цьому вчителю (без винятку для teacher_id IS NULL)
  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  /**
   * Урок живе в семестрі класу (живий фідбек): раніше календар пускав будь-яку
   * дату, і в журналі з'являлась колонка з чужого семестру. Календар тепер за
   * межі не пускає, але перевірка мусить стояти й тут: клієнт можна обійти.
   *
   * Перевіряються ЛИШЕ нові уроки — уже наявні дати поза семестром лишаються
   * як є. Такі є в живій базі: періоди з'явились у міграції 039 і проставились
   * усім класам поточним, тож уроки минулого семестру формально випадають з
   * періоду свого класу і чіпати їх ця перевірка не повинна.
   */
  const { data: clsRow } = await supabaseForRls
    .from("classes")
    .select("period_code")
    .eq("id", class_id)
    .maybeSingle();

  const periodCode = clsRow?.period_code as string | undefined;
  if (isValidPeriod(periodCode)) {
    const from = periodStartIso(periodCode);
    const to = periodEndIso(periodCode);
    const outside = dates.filter((d) => d < from || d > to);
    if (outside.length > 0) {
      return NextResponse.json(
        {
          error: `Урок можна додати лише в межах семестру, ${periodRangeLabel(periodCode)}`,
        },
        { status: 400 }
      );
    }
  }

  const { data: existingRows } = await supabaseForRls
    .from("lessons")
    .select("date")
    .eq("class_id", class_id)
    .in("date", dates);

  const existingDates = new Set((existingRows ?? []).map((r) => r.date as string));
  const toInsert = dates.filter((d) => !existingDates.has(d));

  // Один-урок-шлях (сумісність): якщо все вже існує, той самий 409, що й раніше.
  if (toInsert.length === 0) {
    return NextResponse.json({ error: "lesson_exists" }, { status: 409 });
  }

  const { data: newLessons, error } = await supabaseForRls
    .from("lessons")
    .insert(toInsert.map((date) => ({ class_id, date })))
    .select("id, date");

  if (error) {
    console.error("Supabase error (lesson insert):", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 400 });
  }

  return NextResponse.json({
    lesson: newLessons?.[0] ?? null,
    lessons: newLessons ?? [],
    inserted: newLessons?.length ?? 0,
    skipped: existingDates.size,
  });
}

export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = DeleteLessonSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { id } = body;

  const { error: entriesError } = await supabaseForRls.from("star_entries").delete().eq("lesson_id", id);
  if (entriesError) {
    console.error("Supabase error (entries delete):", entriesError);
    return NextResponse.json({ error: "Failed to delete lesson entries" }, { status: 400 });
  }

  const { error: lessonError } = await supabaseForRls.from("lessons").delete().eq("id", id);
  if (lessonError) {
    console.error("Supabase error (lesson delete):", lessonError);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
