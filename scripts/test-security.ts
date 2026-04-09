/**
 * StarBoard Security Integration Test Suite
 * Verifies RLS policies and data isolation between teachers.
 * Run: npx ts-node scripts/test-security.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAnon = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runTests() {
  console.log("🧪 Starting Security Integration Tests...\n");

  const testEmailA = `test_teacher_a_${Date.now()}@example.com`;
  const testEmailB = `test_teacher_b_${Date.now()}@example.com`;
  const password = "TestPassword123!";

  let userA: any, userB: any;
  let classAId: string, classBId: string;

  try {
    // 1. Setup: Create Test Users
    console.log("🛠️ Setting up test users...");
    const { data: authA, error: errA } = await supabaseAdmin.auth.admin.createUser({
      email: testEmailA,
      password,
      email_confirm: true
    });
    if (errA) throw errA;
    userA = authA.user;

    const { data: authB, error: errB } = await supabaseAdmin.auth.admin.createUser({
      email: testEmailB,
      password,
      email_confirm: true
    });
    if (errB) throw errB;
    userB = authB.user;

    console.log(`✅ Users created: Teacher A (${userA.id}), Teacher B (${userB.id})`);

    // 2. Setup: Create Test Classes
    console.log("🛠️ Creating test classes...");
    const { data: clsA, error: errClsA } = await supabaseAdmin
      .from("classes")
      .insert({ name: "TEST-CLASS-A", teacher_id: userA.id })
      .select("id")
      .single();
    if (errClsA) throw errClsA;
    classAId = clsA.id;

    const { data: clsB, error: errClsB } = await supabaseAdmin
      .from("classes")
      .insert({ name: "TEST-CLASS-B", teacher_id: userB.id })
      .select("id")
      .single();
    if (errClsB) throw errClsB;
    classBId = clsB.id;

    console.log(`✅ Classes created: Class A (${classAId}), Class B (${classBId})`);

    // 3. Login as Teacher A
    console.log("\n🔑 Logging in as Teacher A...");
    const clientA = supabaseAnon();
    const { data: sessionA, error: loginErrA } = await clientA.auth.signInWithPassword({
      email: testEmailA,
      password
    });
    if (loginErrA) throw loginErrA;

    // 4. Test Isolation
    console.log("\n--- Running Isolation Tests ---");

    // Test 4.1: Teacher A can see Class A
    const { data: seenA, error: errSeenA } = await clientA
      .from("classes")
      .select("id")
      .eq("id", classAId)
      .maybeSingle();
    
    if (seenA?.id === classAId) {
      console.log("✅ TEST 4.1 PASSED: Teacher A can see their own class.");
    } else {
      console.error("❌ TEST 4.1 FAILED: Teacher A cannot see their own class!", errSeenA?.message);
    }

    // Test 4.2: Teacher A CANNOT see Class B
    const { data: seenB, error: errSeenB } = await clientA
      .from("classes")
      .select("id")
      .eq("id", classBId)
      .maybeSingle();
    
    if (!seenB) {
      console.log("✅ TEST 4.2 PASSED: Teacher A CANNOT see Teacher B's class.");
    } else {
      console.error("❌ TEST 4.2 FAILED: Teacher A leaked Teacher B's class!");
    }

    // Test 4.3: Teacher A CANNOT write to Class B
    const { error: errWriteB } = await clientA
      .from("classes")
      .update({ name: "HACKED" })
      .eq("id", classBId);
    
    // RLS violations often return 0 rows affected or 42501 error.
    // In supabase-js, if no rows match the filter (due to RLS), error is usually null but data is empty.
    const { data: checkB } = await supabaseAdmin.from("classes").select("name").eq("id", classBId).single();
    if (checkB?.name === "TEST-CLASS-B") {
      console.log("✅ TEST 4.3 PASSED: Teacher A could not modify Teacher B's class.");
    } else {
      console.error("❌ TEST 4.3 FAILED: Teacher A successfully modified Teacher B's class!");
    }

    console.log("\n--- RLS Verification Complete ---");

  } catch (err: any) {
    console.error("\n💥 Error during tests:", err.message);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    if (classAId!) await supabaseAdmin.from("classes").delete().eq("id", classAId);
    if (classBId!) await supabaseAdmin.from("classes").delete().eq("id", classBId);
    if (userA!) await supabaseAdmin.auth.admin.deleteUser(userA.id);
    if (userB!) await supabaseAdmin.auth.admin.deleteUser(userB.id);
    console.log("✅ Cleanup complete.");
  }
}

runTests();
