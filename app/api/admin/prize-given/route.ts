import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { claimClassIfUnassigned } from "@/lib/admin/autoClaim";

const PrizeGivenSchema = z.object({
  student_id: z.string(),
  prize_id: z.string(),
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

  // Find class_id for the student to perform auto-claim
  const { data: student } = await supabaseForRls
    .from("students")
    .select("class_id")
    .eq("id", student_id)
    .single();

  if (student?.class_id) {
    const claim = await claimClassIfUnassigned(supabaseForRls, student.class_id, user.id);
    // We don't block if claim fails here, RLS will handle the final decision
  }

  if (given) {
    const { error } = await supabaseForRls.from("prizes_given").insert({ student_id, prize_id });
    if (error) {
      console.error("Supabase error (prize insert):", error);
      return NextResponse.json({ error: `Помилка бази даних (приз): ${error.message} (код: ${error.code})` }, { status: 400 });
    }
  } else {
    const { error } = await supabaseForRls
      .from("prizes_given")
      .delete()
      .eq("student_id", student_id)
      .eq("prize_id", prize_id);
    if (error) {
      console.error("Supabase error (prize delete):", error);
      return NextResponse.json({ error: `Помилка бази даних (приз видалення): ${error.message} (код: ${error.code})` }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
