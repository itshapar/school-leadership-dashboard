import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOwnedClass } from "@/lib/admin/resolveClass";
import { loadAllEntryTypes } from "@/lib/admin/classConfig";
import EntryHistoryClient, {
  type HistoryRow,
} from "@/components/Admin/EntryHistoryClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

/**
 * Історія нарахувань поза журналом.
 *
 * Фільтр — за типами, які НЕ прив'язані до уроку (раніше було
 * `.in("type", ["bonus","penalty"])`). Типи тягнемо разом із прихованими:
 * запис типом, який вчитель потім сховав, мусить лишатися підписаним.
 */
export default async function EntryHistoryPage({ params }: Props) {
  const { classId: classParam } = await params;
  const supabase = await createSupabaseServerClient();

  const cls = await resolveOwnedClass(supabase, classParam);
  if (!cls) return notFound();

  const entryTypes = await loadAllEntryTypes(supabase, cls.id);
  const nonLessonTypeIds = entryTypes
    .filter((t) => !t.is_lesson_bound)
    .map((t) => t.id);

  let rows: HistoryRow[] = [];

  if (nonLessonTypeIds.length > 0) {
    const { data } = await supabase
      .from("star_entries")
      .select(
        "id, student_id, entry_type_id, amount, note, created_at, scope, group_id, batch_id, students(full_name, avatar_emoji)"
      )
      .eq("class_id", cls.id)
      .in("entry_type_id", nonLessonTypeIds)
      .order("created_at", { ascending: false })
      .limit(200);

    rows = (data ?? []) as unknown as HistoryRow[];
  }

  const { data: groups } = await supabase
    .from("class_groups")
    .select("id, name")
    .eq("class_id", cls.id);

  return (
    <EntryHistoryClient
      classCode={cls.public_code}
      className={cls.name}
      rows={rows}
      entryTypes={entryTypes}
      groups={(groups ?? []) as Array<{ id: string; name: string }>}
    />
  );
}
