/**
 * StarBoard Seed Script (Fixed History)
 * Run: npx ts-node scripts/seed-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLASS_IDS = {
  "7А": "11111111-0000-0000-0000-000000000001",
  "7Б": "11111111-0000-0000-0000-000000000002",
  "7В": "11111111-0000-0000-0000-000000000003",
  "7Г": "11111111-0000-0000-0000-000000000004",
  "7Д": "11111111-0000-0000-0000-000000000005",
  "7Е": "11111111-0000-0000-0000-000000000006",
};

interface StudentData {
  full_name: string;
  avatar_emoji: string;
  nickname: string | null;
  stars: number[];
}

interface ClassData {
  dates: string[];
  students: StudentData[];
}

// ─── 7А ───────────────────────────────────────────────────────────────────────
const DATA_7A: ClassData = {
  dates: [
    "2024-02-06", "2024-02-13", "2024-02-20", "2024-02-27",
    "2024-03-06", "2024-03-13", "2024-03-20", "2024-03-27",
    "2024-04-03", "2024-04-10", "2024-04-17", "2024-04-24",
    "2024-05-01", "2024-05-08", "2024-05-15", "2024-05-22"
  ],
  students: [
    { full_name: "Бабінчук Аліна", avatar_emoji: "🐷", nickname: "ліна сплетня", stars: [3, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Баляс Поліна", avatar_emoji: "💖", nickname: "gwxzssk", stars: [3, 3, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Бандуренко Андрій", avatar_emoji: "⚔️", nickname: "Oskar of Astoria", stars: [3, 3, 1, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Боровицький Олександр", avatar_emoji: "🫡", nickname: "storm", stars: [3, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Буряк Анна", avatar_emoji: "🙈", nickname: "Ann", stars: [3, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Бухта Поліна", avatar_emoji: "💗", nickname: "simmy", stars: [0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Вискобчук Валерія", avatar_emoji: "🐷", nickname: "лера сплетня", stars: [3, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Гавриленко Матвій", avatar_emoji: "🥲", nickname: "Zoom user", stars: [3, 0, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Гаврись Вікторія", avatar_emoji: "👾", nickname: "evi", stars: [3, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Гаман Карина", avatar_emoji: "🥀", nickname: "Дружина Мілани", stars: [3, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Колосюк Ілля", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Кравченко Марія", avatar_emoji: "🎀", nickname: "Maria K", stars: [0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Мазяр Максим", avatar_emoji: "🤫", nickname: "Таврія Чечельник", stars: [3, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Макаренко Михайло", avatar_emoji: "🫵", nickname: "мс Василина", stars: [3, 3, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Мартищук Павло", avatar_emoji: "😐", nickname: "alert_tartan3", stars: [3, 1, 2, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Моргун Артем", avatar_emoji: "🎮", nickname: "Sans PS 3", stars: [3, 3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Радкевич Крістіна", avatar_emoji: "🙈", nickname: "monika", stars: [3, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Тимошенко Анна", avatar_emoji: "🦊", nickname: null, stars: [3, 3, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Яцкова Мілана", avatar_emoji: "🦖", nickname: "Голова Картелю", stars: [3, 0, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ]
};

// ─── 7Б ───────────────────────────────────────────────────────────────────────
const DATA_7B: ClassData = {
  dates: [
    "2024-02-13", "2024-02-20", "2024-02-26", "2024-02-27", "2024-03-05", "2024-03-06", "2024-03-12", "2024-03-13", "2024-03-19", "2024-03-20"
  ],
  students: [
    { full_name: "Алексеєнко Владислава", avatar_emoji: "👾", nickname: "wellxq", stars: [3, 1, 3, 3, 2, 0, 2, 1, 1, 0] },
    { full_name: "Анохін Владислав", avatar_emoji: "☠️", nickname: "zeleboba", stars: [2, 1, 2, 2, 0, 0, 3, 0, 1, 1] },
    { full_name: "Веретельник Аріна", avatar_emoji: "🎀", nickname: "arinx", stars: [0, 1, 0, 0, 2, 0, 1, 0, 1, 1] },
    { full_name: "Ворона Іван", avatar_emoji: "👹", nickname: "enshteyn", stars: [0, 1, 0, 1, 0, 0, 0, 0, 1, 1] },
    { full_name: "Гециу Ярослав", avatar_emoji: "😎", nickname: "yarik", stars: [0, 2, 0, 1, 0, 0, 0, 0, 0, 0] },
    { full_name: "Грицаюк Валерія", avatar_emoji: "😛", nickname: "крамбл кукі лера", stars: [3, 1, 0, 0, 3, 0, 3, 2, 1, 1] },
    { full_name: "Дем'янчук Владислав", avatar_emoji: "🐯", nickname: null, stars: [1, 1, 0, 0, 0, 0, 0, 1, 1, 1] },
    { full_name: "Кравченко Матвій", avatar_emoji: "📷", nickname: "mkravchenko31", stars: [3, 3, 0, 2, 1, 0, 2, 2, 1, 1] },
    { full_name: "Крекча Лев", avatar_emoji: "🐯", nickname: null, stars: [0, 1, 0, 0, 0, 0, 1, 2, 1, 3] },
    { full_name: "Кузьменко Дмитро", avatar_emoji: "🐍", nickname: "baobab", stars: [3, 1, 0, 3, 2, 0, 2, 3, 1, 1] },
    { full_name: "Куценко Поліна", avatar_emoji: "🧸", nickname: "kutsenko polina", stars: [3, 3, 0, 1, 2, 0, 3, 1, 1, 1] },
    { full_name: "Маліцький Назарій", avatar_emoji: "🥱", nickname: "борощук", stars: [0, 1, 0, 3, 0, 0, 0, 0, 0, 1] },
    { full_name: "Машківський Олександр", avatar_emoji: "😁", nickname: "sasha", stars: [3, 1, 0, 1, 0, 0, 2, 1, 1, 1] },
    { full_name: "Перепелиця Максим", avatar_emoji: "🫡", nickname: "дінк", stars: [0, 1, 0, 3, 0, 0, 1, 1, 1, 0] },
    { full_name: "Ротань Анастасія", avatar_emoji: "🦭", nickname: "чізбургер", stars: [0, 2, 0, 2, 2, 0, 1, 1, 2, 0] },
  ]
};

// ─── 7В ───────────────────────────────────────────────────────────────────────
const DATA_7V: ClassData = {
  dates: [ "2024-02-13", "2024-02-20", "2024-02-27", "2024-03-06", "2024-03-13", "2024-03-20" ],
  students: [
    { full_name: "Бесараб Артем", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 2, 0] },
    { full_name: "Бортнічук Владислав", avatar_emoji: "👾", nickname: "Saki4", stars: [0, 0, 1, 0, 0, 0] },
    { full_name: "Власов Володимир", avatar_emoji: "👹", nickname: "prosto", stars: [3, 0, 1, 0, 1, 0] },
    { full_name: "Гайдай Максим", avatar_emoji: "😎", nickname: "кіт", stars: [0, 0, 1, 0, 1, 0] },
    { full_name: "Гамарець Дмитро", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0] },
    { full_name: "Гнилицька Олександра", avatar_emoji: "🦭", nickname: "арангутанг", stars: [3, 0, 1, 0, 2, 0] },
    { full_name: "Дементович Поліна", avatar_emoji: "😝", nickname: "шиншила", stars: [0, 0, 1, 3, 1, 1] },
    { full_name: "Дубовська Софія", avatar_emoji: "🙈", nickname: "макака", stars: [3, 0, 1, 0, 1, 0] },
    { full_name: "Кудрик Злата", avatar_emoji: "🐯", nickname: null, stars: [3, 0, 1, 0, 1, 0] },
    { full_name: "Левківський Василь", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0] },
    { full_name: "Лущан Аніта", avatar_emoji: "🐒", nickname: "обєзяна", stars: [3, 0, 1, 0, 2, 0] },
    { full_name: "Мелешко Ігор", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 1, 0] },
    { full_name: "Плохотнюк Софія", avatar_emoji: "🎀", nickname: "джуді хопс", stars: [0, 0, 2, 0, 1, 0] },
  ]
};

// ─── 7Г ───────────────────────────────────────────────────────────────────────
const DATA_7G: ClassData = {
  dates: [
    "2024-02-13", "2024-02-19", "2024-02-20", "2024-02-26", "2024-02-27",
    "2024-03-05", "2024-03-06", "2024-03-12", "2024-03-13", "2024-03-19"
  ],
  students: [
    { full_name: "Андреєв Євгеній", avatar_emoji: "😎", nickname: "Zhenyok", stars: [0, 1, 1, 0, 1, 1, 2, 2, 0, 1] },
    { full_name: "Білюк Аріна", avatar_emoji: "😔", nickname: "рара", stars: [3, 1, 2, 1, 1, 2, 0, 0, 0, 1] },
    { full_name: "Дьяченко Владислав", avatar_emoji: "👾", nickname: "V1AR", stars: [3, 3, 1, 1, 1, 2, 1, 2, 2, 1] },
    { full_name: "Загарук Богдан", avatar_emoji: "😎", nickname: "білок айранчик", stars: [0, 1, 1, 1, 1, 1, 0, 1, 1, 1] },
    { full_name: "Іванченко Максим", avatar_emoji: "☠️", nickname: "blox fruits", stars: [0, 1, 1, 1, 1, 0, 3, 0, 0, 1] },
    { full_name: "Калита Юрій", avatar_emoji: "🫥", nickname: "Nsair", stars: [0, 1, 1, 0, 0, 0, 0, 0, 0, 0] },
    { full_name: "Коротинський Артем", avatar_emoji: "😈", nickname: "ARTEMKO", stars: [0, 1, 3, 0, 1, 3, 0, 0, 0, 2] },
    { full_name: "Кузьменко Ілля", avatar_emoji: "👹", nickname: "крутоі поцін", stars: [0, 1, 1, 1, 1, 3, 0, 2, 2, 1] },
    { full_name: "Кумечко Денис", avatar_emoji: "🤔", nickname: "keyosuke", stars: [0, 1, 1, 1, 1, 0, 0, 1, 0, 1] },
    { full_name: "Куценко Артем", avatar_emoji: "👾", nickname: "black win", stars: [0, 1, 1, 1, 1, 2, 1, 1, 2, 1] },
    { full_name: "Максименко Єва", avatar_emoji: "🥺", nickname: "дівчинка", stars: [0, 1, 1, 1, 1, 1, 0, 1, 0, 0] },
    { full_name: "Омельчук Артем", avatar_emoji: "🩸", nickname: "Blood", stars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
    { full_name: "Сучіліна Ксенія", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 0, 1, 1, 0, 0, 1, 1, 1] },
  ]
};

// ─── 7Д ───────────────────────────────────────────────────────────────────────
const DATA_7D: ClassData = {
  dates: [
    "2024-02-13", "2024-02-20", "2024-02-26", "2024-02-27", "2024-03-05", "2024-03-06", "2024-03-12", "2024-03-13", "2024-03-19", "2024-03-20"
  ],
  students: [
    { full_name: "Андреєва Альона", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0, 1, 2, 2, 3] },
    { full_name: "Андрієнко Кіріл", avatar_emoji: "😈", nickname: "ww3", stars: [0, 1, 1, 0, 2, 0, 0, 0, 1, 1] },
    { full_name: "Баранова Аріна", avatar_emoji: "🎀", nickname: null, stars: [0, 2, 1, 0, 3, 0, 0, 2, 2, 1] },
    { full_name: "Блоха Дмитро", avatar_emoji: "👀", nickname: "джейк", stars: [3, 1, 1, 0, 0, 0, 3, 0, 2, 1] },
    { full_name: "Бушман Марія", avatar_emoji: "🫥", nickname: "chat", stars: [0, 1, 1, 0, 2, 0, 0, 0, 0, 0] },
    { full_name: "Вишневська Євангеліна", avatar_emoji: "🐖", nickname: "брейнрот", stars: [0, 1, 1, 0, 0, 0, 2, 0, 0, 0] },
    { full_name: "Гріховодов Матвій", avatar_emoji: "🍆", nickname: "баклан", stars: [0, 1, 1, 0, 0, 0, 1, 2, 3, 2] },
    { full_name: "Даниленко Нікіта", avatar_emoji: "🩻", nickname: "рік-огірок", stars: [3, 3, 1, 0, 2, 0, 2, 2, 1, 0] },
    { full_name: "Жуковська Дар'я", avatar_emoji: "🐞", nickname: "жук", stars: [0, 3, 1, 0, 0, 0, 0, 0, 2, 0] },
    { full_name: "Леухіна Вероніка", avatar_emoji: "🍵", nickname: "чайок", stars: [0, 1, 1, 0, 1, 0, 0, 0, 2, 0] },
    { full_name: "Липський Роман", avatar_emoji: "😶‍🌫️", nickname: "rom41k", stars: [3, 1, 1, 0, 0, 0, 2, 2, 1, 1] },
    { full_name: "Лопуга Ангеліна", avatar_emoji: "🤍", nickname: null, stars: [0, 1, 1, 0, 0, 0, 0, 0, 1, 2] },
    { full_name: "Лученко Олександр", avatar_emoji: "🦭", nickname: "вочдемо", stars: [0, 2, 1, 0, 0, 0, 0, 0, 2, 0] },
    { full_name: "Сударчиков Єгор", avatar_emoji: "🎭", nickname: "mavr1kx", stars: [0, 1, 1, 0, 3, 0, 0, 0, 3, 2] },
    { full_name: "Черепинець Валерій", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0] },
  ]
};

// ─── 7Е ───────────────────────────────────────────────────────────────────────
const DATA_7E: ClassData = {
  dates: [
    "2024-02-13", "2024-02-20", "2024-02-26", "2024-02-27", "2024-03-05", "2024-03-06", "2024-03-12", "2024-03-13", "2024-03-19"
  ],
  students: [
    { full_name: "Аксютенко Дмитро", avatar_emoji: "🫡", nickname: "DuMaNaToR", stars: [3, 2, 1, 2, 0, 0, 1, 2, 0] },
    { full_name: "Барчук Софія", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0, 0, 0, 0] },
    { full_name: "Гордін Даніїл", avatar_emoji: "💣", nickname: "danilenko", stars: [0, 2, 1, 2, 0, 0, 1, 2, 1] },
    { full_name: "Горобець Каріна", avatar_emoji: "🪷", nickname: "karinka", stars: [0, 2, 1, 2, 0, 0, 0, 0, 0] },
    { full_name: "Зінич Тимофій", avatar_emoji: "👀", nickname: "Titikaka", stars: [3, 2, 1, 0, 0, 0, 2, 1, 1] },
    { full_name: "Кадубенко Тимур", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 0, 0, 0, 0, 0, 0] },
    { full_name: "Каргалик Дарія", avatar_emoji: "🫏", nickname: "dari", stars: [0, 2, 1, 2, 3, 2, 1, 1, 2] },
    { full_name: "Квасницький Давід", avatar_emoji: "👹", nickname: "davidenko", stars: [0, 2, 1, 1, 0, 0, 0, 0, 0] },
    { full_name: "Кобилинська Анна", avatar_emoji: "🦭", nickname: "аксюта", stars: [3, 2, 1, 2, 3, 2, 2, 1, 2] },
    { full_name: "Козак Дмитро", avatar_emoji: "☠️", nickname: "dmitriasik", stars: [0, 2, 1, 2, 0, 0, 0, 0, 1] },
    { full_name: "Кузьменко Єлизавета", avatar_emoji: "🐯", nickname: "Elizaveth", stars: [3, 0, 1, 2, 2, 0, 2, 2, 1] },
    { full_name: "Мотузок Богдан", avatar_emoji: "🐯", nickname: null, stars: [0, 0, 1, 1, 1, 0, 0, 1, 0] },
  ]
};

const ALL_DATA: Record<string, ClassData> = {
  "7А": DATA_7A, "7Б": DATA_7B, "7В": DATA_7V, "7Г": DATA_7G, "7Д": DATA_7D, "7Е": DATA_7E
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 StarBoard seed starting (Fixed History)...\n");

  // 1. Cleanup: Delete existing star_entries and lessons to avoid duplicates
  console.log("🧹 Cleaning up old star entries and lessons...");
  await supabase.from("star_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("lessons").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const [className, classData] of Object.entries(ALL_DATA)) {
    const classId = CLASS_IDS[className as keyof typeof CLASS_IDS];
    console.log(`\n📚 Processing ${className} (${classData.students.length} students, ${classData.dates.length} dates)...`);

    // 2. Insert lessons with specific dates
    const lessonMapping: Record<string, string> = {};
    for (const dateStr of classData.dates) {
      const { data: lesson, error } = await supabase
        .from("lessons")
        .insert({ class_id: classId, date: dateStr })
        .select("id")
        .single();
      
      if (error) {
        console.error(`  ❌ Failed lesson ${dateStr}:`, error.message);
      } else {
        lessonMapping[dateStr] = lesson.id;
      }
    }

    // 3. Process students
    for (const student of classData.students) {
      // Find or create student
      const { data: existing } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId)
        .eq("full_name", student.full_name)
        .maybeSingle();

      let studentId: string;
      if (existing) {
        studentId = existing.id;
      } else {
        const { data: neu } = await supabase
          .from("students")
          .insert({
            class_id: classId,
            full_name: student.full_name,
            nickname: student.nickname,
            avatar_emoji: student.avatar_emoji
          })
          .select("id")
          .single();
        studentId = neu!.id;
      }

      // Insert star entries with backdated created_at
      const entries = [];
      for (let i = 0; i < classData.dates.length; i++) {
        const stars = student.stars[i];
        if (!stars || stars <= 0) continue;

        const dateStr = classData.dates[i];
        const lessonId = lessonMapping[dateStr];
        
        entries.push({
          student_id: studentId,
          class_id: classId,
          lesson_id: lessonId,
          type: "lesson",
          amount: stars,
          created_at: new Date(dateStr).toISOString() // This is the key fix
        });
      }

      if (entries.length > 0) {
        const { error } = await supabase.from("star_entries").insert(entries);
        if (error) console.error(`  ❌ Failed entries for ${student.full_name}:`, error.message);
        else console.log(`  ✅ ${student.full_name}: ${entries.length} days of stars.`);
      }
    }
  }

  console.log("\n🎉 Seed (Fixed History) complete!");
}

main().catch(console.error);
