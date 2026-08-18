import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";

const StarEntrySchema = z.object({
  student_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  class_id: z.string().uuid(),
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
      amount: rawBody.amount !== undefined ? Number(rawBody.amount) : undefined
    });
  } catch {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { student_id, lesson_id, class_id, amount } = body;

  // Клас має належати цьому вчителю (без винятку для teacher_id IS NULL)
  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  // If amount is 0, we delete the entry to avoid filling the DB with empty rows
  // and bypass the NOT NULL / amount != 0 check if it exists.
  if (amount === 0) {
    const { error } = await supabaseForRls
      .from("star_entries")
      .delete()
      .eq("student_id", student_id)
      .eq("lesson_id", lesson_id)
      .eq("type", "lesson");

    // PGRST116 = row not found — idempotent, treat as success
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
      type: "lesson",
      amount,
    },
    { onConflict: "student_id,lesson_id,type" }
  );

  if (error) {
    console.error("Supabase error (upsert):", error);
    return NextResponse.json({ error: "Failed to save star entry" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
