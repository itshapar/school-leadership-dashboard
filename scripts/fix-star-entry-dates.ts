import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStarEntryDates() {
  console.log("Fetching star entries with year 2024...");
  
  const { data: entries, error } = await supabase
    .from("star_entries")
    .select("id, created_at");

  if (error) {
    console.error("Error fetching entries:", error);
    return;
  }

  const toFix = (entries || []).filter(e => e.created_at.startsWith("2024-"));

  if (toFix.length === 0) {
    console.log("No star entries with 2024 date found.");
    return;
  }

  console.log(`Found ${toFix.length} entries to fix.`);

  for (const entry of toFix) {
    const timestamp = entry.created_at;
    const datePart = timestamp.split("T")[0];
    const timePart = timestamp.split("T")[1];
    
    const [year, month, day] = datePart.split("-");
    let newYear = "2026";
    
    // If month is Sep-Dec (09-12), it's likely from the first half of the academic year (2025)
    if (parseInt(month) >= 9) {
      newYear = "2025";
    }

    const newDate = `${newYear}-${month}-${day}`;
    const newTimestamp = `${newDate}T${timePart}`;
    
    console.log(`Updating entry ${entry.id}: ${entry.created_at} -> ${newTimestamp}`);

    const { error: updateError } = await supabase
      .from("star_entries")
      .update({ created_at: newTimestamp })
      .eq("id", entry.id);

    if (updateError) {
      console.error(`Error updating entry ${entry.id}:`, updateError);
    }
  }

  console.log("Done!");
}

fixStarEntryDates();
