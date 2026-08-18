import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in env!");
  process.exit(1);
}

console.log("Connecting to:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Sending query...");
  try {
    const start = Date.now();
    const { data, error } = await supabase.from('classes').select('id, name');
    const duration = Date.now() - start;
    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log(`Success! Took ${duration}ms. Found ${data?.length} classes:`, data);
    }
  } catch (e) {
    console.error("Exception occurred:", e);
  }
}

run();
