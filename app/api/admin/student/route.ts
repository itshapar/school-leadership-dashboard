import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: {
    id: string;
    full_name?: string;
    nickname?: string;
    avatar_emoji?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, full_name, nickname, avatar_emoji } = body;
  
  if (!id) {
    return NextResponse.json({ error: "Missing student ID" }, { status: 400 });
  }

  const { error } = await db
    .from("students")
    .update({
      full_name,
      nickname,
      avatar_emoji,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  let body: {
    full_name: string;
    nickname?: string;
    avatar_emoji: string;
    class_id: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { full_name, nickname, avatar_emoji, class_id } = body;
  
  if (!full_name || !avatar_emoji || !class_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await db
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
    return NextResponse.json({ error: error.message }, { status: 400 });
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

  if (!id) {
    return NextResponse.json({ error: "Missing student ID" }, { status: 400 });
  }

  const db = createSupabaseAdminClient() ?? supabaseForRls;

  const { error } = await db.from("students").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
