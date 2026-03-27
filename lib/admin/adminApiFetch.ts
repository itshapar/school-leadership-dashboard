import { getSupabaseClient } from "@/lib/supabase/client";

type SupabaseBrowser = ReturnType<typeof getSupabaseClient>;

/**
 * POST/GET до /api/admin/* з cookie + Bearer access_token (Route Handler бачить сесію стабільніше, ніж лише cookies).
 */
export async function adminApiFetch(
  supabase: SupabaseBrowser,
  path: string,
  init: RequestInit = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
}
