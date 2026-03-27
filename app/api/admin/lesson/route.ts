import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: { class_id?: string; date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { class_id, date } = body;
  if (!class_id || !date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("lessons")
    .select("id")
    .eq("class_id", class_id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "lesson_exists" }, { status: 409 });
  }

  const { data: newLesson, error } = await db
    .from("lessons")
    .insert({ class_id, date })
    .select("id, date")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ lesson: newLesson });
}

export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing lesson ID" }, { status: 400 });
  }

  // Deleting lesson also deletes associated star_entries via CASCADE or manually
  // Here we do it manually if not sure about schema
  const { error: entriesError } = await db.from("star_entries").delete().eq("lesson_id", id);
  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 400 });
  }

  const { error: lessonError } = await db.from("lessons").delete().eq("id", id);
  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
