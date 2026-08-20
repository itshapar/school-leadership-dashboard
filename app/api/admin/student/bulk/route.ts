import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";
import { normalizeFullName, validateFullName } from "@/lib/students/fullName";

/**
 * Додавання учнів списком (майстер онбордингу, крок «Учні» → вкладка «Рядками»).
 *
 * Прев'ю «прізвище | ім'я» вчитель уже бачить у формі на клієнті — тут
 * валідація повторюється, бо форму можна обійти прямим запитом.
 *
 * Аватари: емодзі-палітра по колу, щоб список не був однаковим.
 */

const BulkSchema = z.object({
  class_id: z.string().uuid(),
  names: z.array(z.string()).min(1).max(60),
});

const AVATARS = [
  "🦁", "🐯", "🐼", "🦊", "🐨", "🐸", "🦉", "🐧", "🦄", "🐙",
  "🐝", "🦋", "🐬", "🦕", "🐢", "🦔", "🐺", "🦅", "🐴", "🦓",
];

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = BulkSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const claim = await assertClassOwnership(supabaseForRls, body.class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  const valid: string[] = [];
  const invalid: number[] = [];

  body.names.forEach((raw, i) => {
    const normalized = normalizeFullName(raw);
    if (!normalized) return; // порожні рядки просто ігноруємо
    if (validateFullName(normalized).ok) {
      valid.push(normalized);
    } else {
      invalid.push(i + 1);
    }
  });

  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `Рядки ${invalid.join(", ")}: потрібні прізвище та ім'я (два слова)`,
        invalidLines: invalid,
      },
      { status: 400 }
    );
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "Список порожній" }, { status: 400 });
  }

  // Не додаємо тих, хто вже є: майстер можна пройти двічі.
  const { data: existing } = await supabaseForRls
    .from("students")
    .select("full_name")
    .eq("class_id", body.class_id)
    .is("deleted_at", null);

  const existingNames = new Set(
    (existing ?? []).map((s) => (s.full_name as string).toLowerCase())
  );

  const toInsert = valid
    .filter((name) => !existingNames.has(name.toLowerCase()))
    .map((full_name, i) => ({
      class_id: body.class_id,
      full_name,
      avatar_emoji: AVATARS[i % AVATARS.length],
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: valid.length });
  }

  const { data, error } = await supabaseForRls
    .from("students")
    .insert(toInsert)
    .select("id, full_name, nickname, avatar_emoji, group_id");

  if (error) {
    console.error("Supabase error (students bulk insert):", error);
    const limitHit = error.message?.includes("Досягнуто ліміт");
    return NextResponse.json(
      {
        error: limitHit
          ? "Досягнуто ліміт: не більше 60 учнів у класі"
          : "Не вдалося додати учнів",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: data?.length ?? 0,
    skipped: valid.length - toInsert.length,
    students: data ?? [],
  });
}
