/**
 * Generate weekly lessons (Wednesdays) until 2024-05-31 for all classes.
 * Run: npx ts-node scripts/generate-future-lessons.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CLASS_IDS = [
  "11111111-0000-0000-0000-000000000001",
  "11111111-0000-0000-0000-000000000002",
  "11111111-0000-0000-0000-000000000003",
  "11111111-0000-0000-0000-000000000004",
  "11111111-0000-0000-0000-000000000005",
  "11111111-0000-0000-0000-000000000006",
];

async function main() {
  console.log("🚀 Generating future lessons until 2024-05-31...");

  const startDate = new Date("2024-03-28"); // Start after the seed history
  const endDate = new Date("2024-05-31");

  const dates: string[] = [];
  let d = new Date(startDate);
  while (d <= endDate) {
    if (d.getDay() === 3) { // Wednesday
      dates.push(d.toISOString().split("T")[0]);
    }
    d.setDate(d.getDate() + 1);
  }

  console.log(`📅 Prepared ${dates.length} future dates.`);

  for (const classId of CLASS_IDS) {
    console.log(`📚 Processing class ${classId}...`);

    const lessonsToInsert = dates.map(date => ({
      class_id: classId,
      date: date
    }));

    const { error } = await supabase.from("lessons").insert(lessonsToInsert);
    if (error) {
      console.error(`  ❌ Failed to insert lessons for ${classId}:`, error.message);
    } else {
      console.log(`  ✅ Inserted ${dates.length} lessons.`);
    }
  }

  console.log("\n🎉 Future lessons generation complete!");
}

main().catch(console.error);
