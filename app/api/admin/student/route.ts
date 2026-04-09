import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { z } from "zod";
import { claimClassIfUnassigned } from "@/lib/admin/autoClaim";

const PatchStudentSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().optional(),
  nickname: z.string().optional().nullable(),
  avatar_emoji: z.string().optional(),
});

const PostStudentSchema = z.object({
  full_name: z.string().min(1),
  nickname: z.string().optional().nullable(),
  avatar_emoji: z.string().min(1),
  class_id: z.string().uuid(),
});

export async function PATCH(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PatchStudentSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { id, full_name, nickname, avatar_emoji } = body;

  const { error } = await supabaseForRls
    .from("students")
    .update({
      full_name,
      nickname,
      avatar_emoji,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Database error during update" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = PostStudentSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { full_name, nickname, avatar_emoji, class_id } = body;

  // Auto-claim class if unassigned
  const claim = await claimClassIfUnassigned(supabaseForRls, class_id, user.id);
  if (!claim.success) {
    return NextResponse.json({ error: claim.error || "Permission denied" }, { status: 403 });
  }

  const { data, error } = await supabaseForRls
    .from("students")
    .insert({
      full_name,
      nickname,
      avatar_emoji,
      class_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Database error during insert" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, student: data });
}

export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing or invalid student ID" }, { status: 400 });
  }

  const { error } = await supabaseForRls.from("students").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Database error during deletion" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
