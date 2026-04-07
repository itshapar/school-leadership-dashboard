import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";

const PrizeGivenSchema = z.object({
  student_id: z.string().uuid(),
  prize_id: z.string().uuid(),
  given: z.boolean(),
});

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PrizeGivenSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { student_id, prize_id, given } = body;

  if (given) {
    const { error } = await supabaseForRls.from("prizes_given").insert({ student_id, prize_id });
    if (error) return NextResponse.json({ error: "Database error during insert" }, { status: 400 });
  } else {
    const { error } = await supabaseForRls
      .from("prizes_given")
      .delete()
      .eq("student_id", student_id)
      .eq("prize_id", prize_id);
    if (error) return NextResponse.json({ error: "Database error during deletion" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
