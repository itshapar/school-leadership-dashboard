import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { randomUUID } from "node:crypto";

/**
 * Нарахування поза журналом: учню, ГРУПІ або всьому класу.
 *
 * Модель групового нарахування — FAN-OUT: по рядку на кожного учня групи
 * (як і всі 1374 наявні рядки), а не один «груповий» рядок. Причина:
 * інакше кожна агрегація «скільки зірок у учня» мусила б знати про групи
 * і їхній історичний склад на момент нарахування. Провенанс операції
 * зберігають scope/group_id/batch_id (міграція 015), а спільний batch_id
 * дає дешеве масове скасування одним DELETE.
 *
 * Склад групи резолвиться НА СЕРВЕРІ. Приймати список учнів від клієнта не
 * можна: RLS відсіє чужих, але свій учень з іншої групи проліз би тихо.
 *
 * Класове нарахування лишається одним рядком зі student_id IS NULL —
 * так його рахує public_class_overview (ключ class_bonus). Рішення про
 * перехід класових нарахувань на fan-out свідомо відкладене (коментар у 020).
 */

const TargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("student"), student_id: z.string().uuid() }),
  z.object({ kind: z.literal("group"), group_id: z.string().uuid() }),
  z.object({ kind: z.literal("class") }),
]);

const EntrySchema = z.object({
  class_id: z.string().uuid(),
  entry_type_id: z.string().uuid(),
  amount: z.number().int().min(-100).max(100).refine((v) => v !== 0, {
    message: "Нарахування на 0 не має сенсу",
  }),
  note: z.string().max(500).nullable().optional(),
  target: TargetSchema,
});

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = EntrySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { class_id, entry_type_id, amount, note, target } = body;

  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

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

  const base = {
    class_id,
    entry_type_id,
    amount,
    note: note?.trim() ? note.trim() : null,
  };

  let rows: Array<Record<string, unknown>>;

  if (target.kind === "student") {
    // Учень мусить бути з цього класу — інакше клієнт міг би підкласти
    // свого ж учня з іншого класу і зіпсувати обидві статистики.
    const { data: student } = await supabaseForRls
      .from("students")
      .select("id")
      .eq("id", target.student_id)
      .eq("class_id", class_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: "Учня не знайдено в цьому класі" }, { status: 400 });
    }
    rows = [{ ...base, student_id: target.student_id, scope: "student" }];
  } else if (target.kind === "group") {
    const { data: group } = await supabaseForRls
      .from("class_groups")
      .select("id")
      .eq("id", target.group_id)
      .eq("class_id", class_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено в цьому класі" }, { status: 400 });
    }

    const { data: members } = await supabaseForRls
      .from("students")
      .select("id")
      .eq("class_id", class_id)
      .eq("group_id", target.group_id)
      .is("deleted_at", null);

    if (!members || members.length === 0) {
      return NextResponse.json({ error: "У групі немає учнів" }, { status: 400 });
    }

    // Один batch_id на всю операцію — це і є «скасувати одним рухом».
    const batchId = randomUUID();
    rows = members.map((m) => ({
      ...base,
      student_id: m.id,
      scope: "group",
      group_id: target.group_id,
      batch_id: batchId,
    }));
  } else {
    rows = [{ ...base, student_id: null, scope: "class" }];
  }

  // Один INSERT — або всі рядки, або жодного. Часткове нарахування «половині
  // групи» було б гіршим за помилку: вчитель його не помітить.
  const { error } = await supabaseForRls.from("star_entries").insert(rows);

  if (error) {
    console.error("Supabase error (entry insert):", error);
    return NextResponse.json({ error: "Не вдалося зберегти нарахування" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}

/**
 * Видалення: одного запису (`?id=`) або цілої групової операції (`?batch_id=`).
 * RLS звужує обидва варіанти до власних класів; додаткової перевірки не треба,
 * бо DELETE без відповідних рядків — просто no-op.
 */
export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const batchId = searchParams.get("batch_id");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const query = supabaseForRls.from("star_entries").delete();
  if (batchId && UUID_RE.test(batchId)) {
    const { error } = await query.eq("batch_id", batchId);
    if (error) {
      return NextResponse.json({ error: "Не вдалося скасувати операцію" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (id && UUID_RE.test(id)) {
    const { error } = await query.eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Не вдалося видалити запис" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing or invalid identifier" }, { status: 400 });
}
