import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Школи та паралелі — ОПЦІОНАЛЬНІ «папки» вчителя (міграція 014).
 *
 * Три речі, які легко проґавити і які тут закодовані явно:
 *  1. Паралель може існувати БЕЗ школи (кейс автора: паралель «7» без школи).
 *  2. Клас може лежати де завгодно: у школі, у паралелі, в обох, ніде.
 *  3. Школа класу автовиводиться з паралелі тригером class_folder_consistency
 *     (014) — фронтенд НЕ мусить її дублювати, інакше вони розійдуться.
 *     Тому переміщення класу пише лише parallel_id, коли паралель обрана.
 *
 * Спільних даних між вчителями немає: RLS — строго teacher_id = auth.uid(),
 * а композитні FK (school_id, teacher_id) не дають прив'язатися до чужої папки.
 */

export interface School {
  id: string;
  name: string;
  sort_order: number;
}

export interface Parallel {
  id: string;
  school_id: string | null;
  name: string;
  sort_order: number;
}

/** Клас у списку кабінету — рівно ті поля, що потрібні для дерева папок. */
export interface ClassFolderRef {
  id: string;
  school_id: string | null;
  parallel_id: string | null;
}

export async function loadSchools(supabase: SupabaseClient): Promise<School[]> {
  const { data } = await supabase
    .from("schools")
    .select("id, name, sort_order")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  return (data ?? []) as School[];
}

export async function loadParallels(supabase: SupabaseClient): Promise<Parallel[]> {
  const { data } = await supabase
    .from("parallels")
    .select("id, school_id, name, sort_order")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Parallel[];
}

/**
 * Переміщення класу між папками.
 *
 * Правило: якщо задана паралель — school_id НЕ надсилаємо взагалі, його
 * проставить тригер 014 зі школи паралелі. Спроба надіслати «свою» школу
 * поряд із паралеллю іншої школи закінчиться помилкою БД
 * «Паралель належить іншій школі» — і це правильно, але вводити вчителя
 * в таку ситуацію з UI ми не будемо.
 */
export async function moveClassToFolder(
  supabase: SupabaseClient,
  classId: string,
  target: { schoolId: string | null; parallelId: string | null }
): Promise<{ error?: string }> {
  const patch: Record<string, string | null> = { parallel_id: target.parallelId };
  if (!target.parallelId) {
    // Клас поза паралеллю — школа задається напряму (або скидається).
    patch.school_id = target.schoolId;
  } else {
    // Паралель без школи не повинна лишати класу школу від попередньої папки.
    patch.school_id = null;
  }

  const { error } = await supabase.from("classes").update(patch).eq("id", classId);
  return { error: error?.message };
}

/** Дерево «школа → паралель → класи» + кошик «без папки» для рендера списку. */
export interface FolderNode<T extends ClassFolderRef> {
  school: School | null;
  parallels: Array<{ parallel: Parallel | null; classes: T[] }>;
}

export function buildFolderTree<T extends ClassFolderRef>(
  schools: School[],
  parallels: Parallel[],
  classes: T[]
): FolderNode<T>[] {
  const nodes: FolderNode<T>[] = [];

  const pushNode = (school: School | null) => {
    const schoolId = school?.id ?? null;
    const ownParallels = parallels.filter((p) => (p.school_id ?? null) === schoolId);

    const buckets = ownParallels.map((parallel) => ({
      parallel: parallel as Parallel | null,
      classes: classes.filter((c) => c.parallel_id === parallel.id),
    }));

    // Класи цієї школи (або зовсім без папки), що не лежать у жодній паралелі.
    const loose = classes.filter(
      (c) => !c.parallel_id && (c.school_id ?? null) === schoolId
    );
    if (loose.length > 0) {
      buckets.push({ parallel: null, classes: loose });
    }

    const hasAnything =
      buckets.some((b) => b.classes.length > 0) || ownParallels.length > 0;
    if (school === null && !hasAnything) return; // порожній «без папки» не показуємо
    nodes.push({ school, parallels: buckets });
  };

  schools.forEach((s) => pushNode(s));
  pushNode(null);

  return nodes;
}
