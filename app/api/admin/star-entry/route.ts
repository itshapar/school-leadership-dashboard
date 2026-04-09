import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { claimClassIfUnassigned } from "@/lib/admin/autoClaim";

const StarEntrySchema = z.object({
  student_id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  class_id: z.string().uuid(),
  amount: z.number(),
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
  } catch (err) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { student_id, lesson_id, class_id, amount } = body;

  // Auto-claim class if unassigned
  const claim = await claimClassIfUnassigned(supabaseForRls, class_id, user.id);
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
    
    if (error) {
      // Avoid leaking internal DB errors in production
      return NextResponse.json({ error: "Database error during deletion" }, { status: 400 });
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
    return NextResponse.json({ 
      error: `Помилка бази даних: ${error.message} (код: ${error.code})` 
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
