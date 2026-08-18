import { NextResponse } from "next/server";
// Trigger redeploy
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { assertClassOwnership } from "@/lib/admin/classOwnership";

const PostLessonSchema = z.object({
  class_id: z.string().uuid(),
  date: z.string().date(),
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

  const { class_id, date } = body;

  // Клас має належати цьому вчителю (без винятку для teacher_id IS NULL)
  const claim = await assertClassOwnership(supabaseForRls, class_id, user.id);
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
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 400 });
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
    return NextResponse.json({ error: "Failed to delete lesson entries" }, { status: 400 });
  }

  const { error: lessonError } = await supabaseForRls.from("lessons").delete().eq("id", id);
  if (lessonError) {
    console.error("Supabase error (lesson delete):", lessonError);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
