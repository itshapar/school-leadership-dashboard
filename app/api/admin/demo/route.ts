import { NextResponse } from "next/server";
import { getSupabaseForAdminApi } from "@/lib/supabase/server";
import { resolveEntryTypes } from "@/lib/admin/entryTypeResolver";

/**
 * Демо-клас: спробувати систему, не вносячи жодних реальних даних учнів.
 *
 * Імена — ВИГАДАНІ, у форматі «Прізвище Ім'я» (той самий, що система вимагає
 * від справжніх записів): демо має вчити правильному формату, а не показувати
 * виняток із нього.
 *
 * Позначка — classes.is_demo (міграція 025), а не назва: клас, який вчитель
 * перейменував, усе одно мусить зникнути по кнопці «Видалити демо-дані».
 *
 * Усе пишеться під сесією вчителя (RLS), без service-role: демо-дані не
 * привілейована операція, і давати їй байпас RLS немає причин.
 */

const DEMO_CLASS_NAME = "Демо-клас 7-А";

const DEMO_STUDENTS: Array<{ name: string; emoji: string; nickname?: string }> = [
  { name: "Вербицька Соломія", emoji: "🦄" },
  { name: "Гайдук Назар", emoji: "🦊", nickname: "Назік" },
  { name: "Дорошенко Аліна", emoji: "🐼" },
  { name: "Заболотний Тимур", emoji: "🦁" },
  { name: "Кириленко Дарина", emoji: "🦋" },
  { name: "Лозовий Богдан", emoji: "🐺" },
  { name: "Марчук Єва", emoji: "🐧" },
  { name: "Небесний Остап", emoji: "🦉", nickname: "Остик" },
  { name: "Панасенко Мілана", emoji: "🐬" },
  { name: "Романюк Гліб", emoji: "🐯" },
  { name: "Сокирко Уляна", emoji: "🐨" },
  { name: "Ясінський Матвій", emoji: "🦕" },
];

/** Детермінований псевдовипадок: демо-клас щоразу однаковий і відтворюваний. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function POST(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Один демо-клас на вчителя: друга кнопка веде в наявний, а не плодить копії.
  const { data: existing } = await supabaseForRls
    .from("classes")
    .select("id, public_code")
    .eq("is_demo", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, existed: true, class: existing });
  }

  const { data: cls, error: clsError } = await supabaseForRls
    .from("classes")
    .insert({ name: DEMO_CLASS_NAME, teacher_id: user.id, is_demo: true })
    .select("id, public_code, name")
    .single();

  if (clsError || !cls) {
    console.error("Supabase error (demo class):", clsError);
    const limitHit = clsError?.message?.includes("Досягнуто ліміт");
    return NextResponse.json(
      {
        error: limitHit
          ? "Досягнуто ліміт: не більше 20 класів на акаунт"
          : "Не вдалося створити демо-клас",
      },
      { status: 400 }
    );
  }

  // Типи нарахувань і призи — із системного шаблону, як у справжнього класу.
  // apply_class_template ідемпотентна і накочує ВСЕ: типи, індивідуальні
  // призи, класові призи. resolveEntryTypes після неї лише читає id-шники.
  await supabaseForRls.rpc("apply_class_template", {
    p_class_id: cls.id,
    p_template_id: null,
  });
  const entryTypes = await resolveEntryTypes(supabaseForRls, cls.id);
  if (!entryTypes) {
    return NextResponse.json({ error: "Не вдалося застосувати шаблон" }, { status: 400 });
  }

  const { data: students, error: stError } = await supabaseForRls
    .from("students")
    .insert(
      DEMO_STUDENTS.map((s) => ({
        class_id: cls.id,
        full_name: s.name,
        nickname: s.nickname ?? null,
        avatar_emoji: s.emoji,
      }))
    )
    .select("id");

  if (stError || !students) {
    console.error("Supabase error (demo students):", stError);
    return NextResponse.json({ error: "Не вдалося створити демо-учнів" }, { status: 400 });
  }

  // Шість уроків назад по тижню від сьогодні.
  const today = new Date();
  const lessonDates: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    lessonDates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  const { data: lessons, error: lsError } = await supabaseForRls
    .from("lessons")
    .insert(lessonDates.map((date) => ({ class_id: cls.id, date })))
    .select("id, date");

  if (lsError || !lessons) {
    console.error("Supabase error (demo lessons):", lsError);
    return NextResponse.json({ error: "Не вдалося створити демо-уроки" }, { status: 400 });
  }

  const entries: Array<Record<string, unknown>> = [];
  students.forEach((student, si) => {
    lessons.forEach((lesson, li) => {
      const roll = pseudoRandom(si * 13 + li * 7 + 1);
      // ~12% пропусків (−1, як «Н» у журналі), решта 1–3 зірки
      const amount = roll < 0.12 ? -1 : 1 + Math.floor(roll * 3);
      entries.push({
        student_id: student.id,
        class_id: cls.id,
        lesson_id: lesson.id,
        entry_type_id: entryTypes.lesson,
        amount,
        scope: "student",
      });
    });

    // Кожному третьому — бонус, щоб історія не була порожньою.
    if (si % 3 === 0) {
      entries.push({
        student_id: student.id,
        class_id: cls.id,
        entry_type_id: entryTypes.positive,
        amount: 2 + Math.floor(pseudoRandom(si + 99) * 3),
        scope: "student",
        note: "Демо: за активність на уроці",
      });
    }
  });

  // Класове нарахування — щоб було видно, як працює спільний прогрес.
  entries.push({
    student_id: null,
    class_id: cls.id,
    entry_type_id: entryTypes.positive,
    amount: 15,
    scope: "class",
    note: "Демо: перемога класу в конкурсі",
  });

  const { error: enError } = await supabaseForRls.from("star_entries").insert(entries);
  if (enError) {
    console.error("Supabase error (demo entries):", enError);
    return NextResponse.json({ error: "Не вдалося створити демо-зірки" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, existed: false, class: cls });
}

/**
 * «Видалити демо-дані»: фізичне видалення всіх демо-класів вчителя.
 * Каскад ON DELETE забирає учнів, уроки, зірки, типи, призи й групи.
 * Soft delete тут був би шкідливим — сенс кнопки саме в тому, щоб слідів
 * не лишилось.
 */
export async function DELETE(request: Request) {
  const { user, supabaseForRls } = await getSupabaseForAdminApi(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseForRls
    .from("classes")
    .delete()
    .eq("is_demo", true)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("Supabase error (demo delete):", error);
    return NextResponse.json({ error: "Не вдалося видалити демо-дані" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
