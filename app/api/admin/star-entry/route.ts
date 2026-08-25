import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { uuidLike } from "@/lib/validation/uuid";

/**
 * Автозбереження клітинки журналу «учень × урок».
 *
 * Етап 6: замість enum `type: 'lesson'` пишемо `entry_type_id` — конкретний
 * тип нарахування цього класу (міграція 015). Стовпець `type` більше не
 * згадується взагалі: до 020 його заповнює тригер-місток, після 020 його
 * не існує. Той самий код працює в обох станах.
 *
 * Опора upsert-а — індекс star_entries_lesson_slot_uq (міграція 025/025a),
 * а не констрейнт unique_student_lesson_type_star із 006, який зникне
 * разом зі стовпцем type.
 */

const StarEntrySchema = z.object({
  student_id: uuidLike,
  lesson_id: uuidLike,
  class_id: uuidLike,
  entry_type_id: uuidLike,
  amount: z.number().int().min(-100).max(100),
});

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    const rawBody = await request.json();
    body = StarEntrySchema.parse({
      ...rawBody,
      amount: rawBody.amount !== undefined ? Number(rawBody.amount) : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { student_id, lesson_id, class_id, entry_type_id, amount } = body;

  // Клас має належати цьому вчителю (без винятку для teacher_id IS NULL)
  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  // Тип мусить бути з ЦЬОГО класу. Композитний FK у БД це теж гарантує
  // (star_entries_type_same_class_fk), але тут помилка зрозуміліша, ніж
  // «violates foreign key constraint».
  const { data: entryType } = await supabaseForRls
    .from("entry_types")
    .select("id")
    .eq("id", entry_type_id)
    .eq("class_id", class_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!entryType) {
    return NextResponse.json({ error: "Тип нарахування недоступний" }, { status: 400 });
  }

  // amount === 0 — це «прибрати оцінку», а не «поставити нуль»: інакше журнал
  // заповнився б рядками-порожняками, які довелося б фільтрувати в кожній
  // агрегації.
  if (amount === 0) {
    const { error } = await supabaseForRls
      .from("star_entries")
      .delete()
      .eq("student_id", student_id)
      .eq("lesson_id", lesson_id)
      .eq("entry_type_id", entry_type_id);

    // PGRST116 = row not found — ідемпотентно, вважаємо успіхом
    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: "Failed to delete entry" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseForRls.from("star_entries").upsert(
    {
      student_id,
      lesson_id,
      class_id,
      entry_type_id,
      amount,
      scope: "student",
    },
    { onConflict: "student_id,lesson_id,entry_type_id" }
  );

  if (error) {
    console.error("Supabase error (upsert):", error);
    return NextResponse.json({ error: "Failed to save star entry" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
