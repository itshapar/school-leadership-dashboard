import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: { student_id?: string; prize_id?: string; given?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { student_id, prize_id, given } = body;
  if (!student_id || !prize_id || typeof given !== "boolean") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (given) {
    const { error } = await db.from("prizes_given").insert({ student_id, prize_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await db
      .from("prizes_given")
      .delete()
      .eq("student_id", student_id)
      .eq("prize_id", prize_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
