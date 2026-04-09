import { NextResponse } from "next/server";
// Trigger redeploy
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { claimClassIfUnassigned } from "@/lib/admin/autoClaim";

const PostLessonSchema = z.object({
  class_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  } catch (err: any) {
    console.error("Zod parse error:", err.errors || err);
    return NextResponse.json({ 
      error: `Помилка даних: ${err.errors ? JSON.stringify(err.errors) : "Invalid request data"}` 
    }, { status: 400 });
  }

  const { class_id, date } = body;

  // Auto-claim class if unassigned
  const claim = await claimClassIfUnassigned(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  const { data: existing } = await supabaseForRls
    .from("lessons")
    .select("id")
    .eq("class_id", class_id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "lesson_exists" }, { status: 409 });
  }

  const { data: newLesson, error } = await supabaseForRls
    .from("lessons")
    .insert({ class_id, date })
    .select("id, date")
    .single();

  if (error) {
    console.error("Supabase error (lesson insert):", error);
    return NextResponse.json({ error: `Помилка бази даних: ${error.message} (код: ${error.code})` }, { status: 400 });
  }

  return NextResponse.json({ lesson: newLesson });
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
    return NextResponse.json({ error: `Помилка бази даних (зірки): ${entriesError.message} (код: ${entriesError.code})` }, { status: 400 });
  }

  const { error: lessonError } = await supabaseForRls.from("lessons").delete().eq("id", id);
  if (lessonError) {
    console.error("Supabase error (lesson delete):", lessonError);
    return NextResponse.json({ error: `Помилка бази даних (урок): ${lessonError.message} (код: ${lessonError.code})` }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
