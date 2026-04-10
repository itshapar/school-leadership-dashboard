import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { claimClassIfUnassigned } from "@/lib/admin/autoClaim";

const ThresholdsSchema = z.object({
  class_id: z.string(),
  game_day_threshold: z.number().optional(),
  pizza_day_threshold: z.number().optional(),
  individual_prizes: z.array(z.object({
    id: z.string(),
    stars_required: z.number(),
    name: z.string().optional(),
  })).optional(),
});

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = ThresholdsSchema.parse(await request.json());
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { class_id, game_day_threshold, pizza_day_threshold, individual_prizes } = body;

  // Auto-claim class if unassigned
  const claim = await claimClassIfUnassigned(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  // Update class thresholds if provided
  if (game_day_threshold !== undefined || pizza_day_threshold !== undefined) {
    const updateData: any = {};
    if (game_day_threshold !== undefined) updateData.game_day_threshold = game_day_threshold;
    if (pizza_day_threshold !== undefined) updateData.pizza_day_threshold = pizza_day_threshold;
    
    const { error: classError } = await supabaseForRls
      .from("classes")
      .update(updateData)
      .eq("id", class_id);

    if (classError) {
      return NextResponse.json({ error: "Failed to update class thresholds" }, { status: 400 });
    }
  }

  // Update individual prizes if provided
  if (individual_prizes && individual_prizes.length > 0) {
    for (const prize of individual_prizes) {
      const updateData: any = { stars_required: prize.stars_required };
      if (prize.name) updateData.name = prize.name;

      const { error: prizeError } = await supabaseForRls
        .from("prizes_individual")
        .update(updateData)
        .eq("id", prize.id)
        .eq("class_id", class_id); // Security check

      if (prizeError) {
        return NextResponse.json({ error: `Failed to update prize ${prize.id}` }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
