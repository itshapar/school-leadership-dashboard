import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { data: existing } = await supabase
    .from("lessons")
    .select("id")
    .eq("class_id", class_id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "lesson_exists" }, { status: 409 });
  }

  const { data: newLesson, error } = await supabase
    .from("lessons")
    .insert({ class_id, date })
    .select("id, date")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ lesson: newLesson });
}
