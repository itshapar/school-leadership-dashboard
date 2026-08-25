import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { normalizeFullName, validateFullName } from "@/lib/students/fullName";
import { uuidLike } from "@/lib/validation/uuid";

/**
 * CRUD учня.
 *
 * Етап 5/6: `full_name` лишається обов'язковим і зберігається САМЕ у форматі
 * «Прізвище Ім'я» — публічний fallback у БД (student_display_name) віддає
 * ДРУГЕ слово, тож інший порядок означав би витік прізвища на публічну
 * сторінку класу. Валідація «щонайменше два слова» стоїть і тут, а не лише
 * у формі: форму можна обійти прямим запитом до API.
 *
 * `group_id` (міграція 014) — опційна група всередині класу; композитний FK
 * students_group_same_class_fk не дасть прив'язати учня до групи чужого класу.
 */

const FullNameField = z
  .string()
  .transform(normalizeFullName)
  .refine((v) => validateFullName(v).ok, {
    message: "Потрібні два слова: спершу прізвище, потім ім'я",
  });

const PatchStudentSchema = z.object({
  id: uuidLike,
  full_name: FullNameField.optional(),
  nickname: z.string().max(60).optional().nullable(),
  avatar_emoji: z.string().max(16).optional(),
  group_id: uuidLike.nullable().optional(),
});

const PostStudentSchema = z.object({
  full_name: FullNameField,
  nickname: z.string().max(60).optional().nullable(),
  avatar_emoji: z.string().min(1).max(16),
  class_id: uuidLike,
  group_id: uuidLike.nullable().optional(),
});

export async function PATCH(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PatchStudentSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Invalid request data"
        : "Invalid request data";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { id, ...rest } = body;

  // Надсилаємо лише те, що клієнт справді передав: інакше PATCH з однією
  // групою затер би нікнейм у NULL.
  const patch: Record<string, unknown> = {};
  if (rest.full_name !== undefined) patch.full_name = rest.full_name;
  if (rest.nickname !== undefined) patch.nickname = rest.nickname;
  if (rest.avatar_emoji !== undefined) patch.avatar_emoji = rest.avatar_emoji;
  if (rest.group_id !== undefined) patch.group_id = rest.group_id;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseForRls.from("students").update(patch).eq("id", id);

  if (error) {
    console.error("Supabase error (student update):", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PostStudentSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Invalid request data"
        : "Invalid request data";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { full_name, nickname, avatar_emoji, class_id, group_id } = body;

  // Клас має належати цьому вчителю (без винятку для teacher_id IS NULL)
  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  const { data, error } = await supabaseForRls
    .from("students")
    .insert({
      full_name,
      nickname: nickname ?? null,
      avatar_emoji,
      class_id,
      group_id: group_id ?? null,
    })
    .select("id, full_name, nickname, avatar_emoji, group_id")
    .single();

  if (error) {
    console.error("Supabase error (student insert):", error);
    // Ліміт 60 учнів на клас приходить із тригера БД (міграція 019) —
    // показуємо вчителю причину, а не «щось пішло не так».
    const limitHit = error.message?.includes("Досягнуто ліміт");
    return NextResponse.json(
      { error: limitHit ? "Досягнуто ліміт: не більше 60 учнів у класі" : "Failed to create student" },
      { status: 400 }
    );
  }

  // PIN одразу при створенні (живий фідбек): без нього новий учень просто
  // не може зайти, а вчитель бачив у списку прочерк і мусив окремо тиснути
  // «скинути PIN». reset_student_pin не SECURITY DEFINER, тож працює під
  // RLS того самого вчителя. Помилку генерації не робимо фатальною: учень
  // уже створений, PIN завжди можна перевипустити з таблиці.
  const { error: pinError } = await supabaseForRls.rpc("reset_student_pin", {
    p_student_id: data.id,
  });
  if (pinError) {
    console.error("Supabase error (initial pin):", pinError);
  }

  return NextResponse.json({ ok: true, student: data });
}

export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing or invalid student ID" }, { status: 400 });
  }

  const { error } = await supabaseForRls.from("students").delete().eq("id", id);

  if (error) {
    console.error("Supabase error (student delete):", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
