import { createClient } from "@supabase/supabase-js";

// Admin client — uses service role key, bypasses RLS
// NEVER expose this to the browser
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
