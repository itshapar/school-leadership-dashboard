import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — cookies can't be set, ignore
          }
        },
      },
    }
  );
}

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Адмінські API: сесія з `Authorization: Bearer` (клієнт передає access_token) або з cookies.
 * Для Bearer обов’язково `getUser(jwt)` — інакше getUser() без аргументу не бачить токен.
 */
export async function getSupabaseForAdminApi(request: Request): Promise<{
  user: User | null;
  supabaseForRls: SupabaseClient;
}> {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const minimal = createClient(url(), anon(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await minimal.auth.getUser(jwt);
    if (error || !user) {
      return { user: null, supabaseForRls: minimal };
    }
    const supabaseForRls = createClient(url(), anon(), {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return { user, supabaseForRls };
  }

  const supabaseForRls = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseForRls.auth.getUser();

  return { user, supabaseForRls };
}
