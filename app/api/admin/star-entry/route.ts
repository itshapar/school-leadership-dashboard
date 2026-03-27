import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: {
    student_id?: string;
    lesson_id?: string;
    class_id?: string;
    amount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { student_id, lesson_id, class_id, amount } = body;
  
  if (!student_id || !lesson_id || !class_id || amount === undefined || amount === null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // If amount is 0, we delete the entry to avoid filling the DB with empty rows
  // and bypass the NOT NULL / amount != 0 check if it exists.
  if (Number(amount) === 0) {
    const { error } = await db
      .from("star_entries")
      .delete()
      .eq("student_id", student_id)
      .eq("lesson_id", lesson_id)
      .eq("type", "lesson");
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await db.from("star_entries").upsert(
    {
      student_id,
      lesson_id,
      class_id,
      type: "lesson",
      amount: Number(amount),
    },
    { onConflict: "student_id,lesson_id,type" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
