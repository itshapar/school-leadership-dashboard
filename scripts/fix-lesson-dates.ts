import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDates() {
  console.log("Fetching lessons with year 2024...");
  
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, date");

  if (error) {
    console.error("Error fetching lessons:", error);
    return;
  }

  const toFix = (lessons || []).filter(l => l.date.startsWith("2024-"));

  if (toFix.length === 0) {
    console.log("No lessons with 2024 date found.");
    return;
  }

  console.log(`Found ${toFix.length} lessons to fix.`);

  for (const lesson of toFix) {
    const [year, month, day] = lesson.date.split("-");
    let newYear = "2026";
    
    // If month is Sep-Dec (09-12), it's likely from the first half of the academic year (2025)
    if (parseInt(month) >= 9) {
      newYear = "2025";
    }

    const newDate = `${newYear}-${month}-${day}`;
    console.log(`Updating lesson ${lesson.id}: ${lesson.date} -> ${newDate}`);

    const { error: updateError } = await supabase
      .from("lessons")
      .update({ date: newDate })
      .eq("id", lesson.id);

    if (updateError) {
      console.error(`Error updating lesson ${lesson.id}:`, updateError);
    }
  }

  console.log("Done!");
}

fixDates();
