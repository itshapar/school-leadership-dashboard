/**
 * StarBoard Security Audit Script
 * Checks for ownerless data and security health.
 * Run: npx ts-node scripts/audit-security.ts
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

async function audit() {
  console.log("🔍 Starting StarBoard Security Audit...\n");

  // 1. Check Classes
  console.log("--- Checking Classes ---");
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, teacher_id");

  if (classesError) {
    console.error("❌ Failed to fetch classes:", classesError.message);
    return;
  }

  const ownerlessClasses = classes.filter(c => !c.teacher_id);
  console.log(`Total Classes: ${classes.length}`);
  console.log(`Ownerless Classes: ${ownerlessClasses.length}`);
  
  if (ownerlessClasses.length > 0) {
    console.warn("\n⚠️ Ownerless Classes Found:");
    ownerlessClasses.forEach(c => console.log(` - ${c.name} (ID: ${c.id})`));
  } else {
    console.log("✅ All classes have owners.");
  }

  // 2. Check for orphaned records (records in other tables whose classes are ownerless)
  console.log("\n--- Checking for Orphaned Records (Linked to ownerless classes) ---");
  
  const ownerlessIds = ownerlessClasses.map(c => c.id);
  
  if (ownerlessIds.length > 0) {
    const tables = ["students", "lessons", "star_entries", "prizes_individual"];
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .in("class_id", ownerlessIds);
      
      if (error) {
        console.error(`❌ Error checking ${table}:`, error.message);
      } else {
        console.log(` - ${table}: ${count} records linked to ownerless classes.`);
      }
    }
  } else {
    console.log("✅ No orphaned records found.");
  }

  // 3. Summary
  console.log("\n--- Audit Summary ---");
  if (ownerlessClasses.length === 0) {
    console.log("🎉 Security Status: EXCELLENT. All data is properly owned.");
  } else {
    console.log("⚠️ Security Status: CAUTION. Some data is ownerless and may be vulnerable or blocked by RLS.");
    console.log("👉 Recommendation: Use the dashboard or a fix script to assign these classes to their respective teachers.");
  }
}

audit().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
