import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /auth/callback — єдина точка обміну коду на сесію (PKCE):
 *   • Google OAuth (signInWithOAuth → consent → сюди з ?code=)
 *   • підтвердження email після реєстрації (emailRedirectTo → сюди)
 *   • лист скидання пароля (redirectTo → сюди з ?next=/reset-password)
 *
 * ?next приймає ЛИШЕ відносний шлях (анти open-redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const rawNext = searchParams.get("next") ?? "/admin";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  // Лист скидання пароля міг прийти в будь-якому з форматів Supabase, і
  // частина з них узагалі не долітає до сервера (токени в хеші адреси).
  // Тому все, що пахне recovery, віддаємо клієнтській сторінці — вона
  // вміє розібрати всі три варіанти (див. app/reset-password/page.tsx).
  if (type === "recovery" || next.startsWith("/reset-password")) {
    const target = new URL(`${origin}/reset-password`);
    if (code) target.searchParams.set("code", code);
    if (tokenHash) {
      target.searchParams.set("token_hash", tokenHash);
      target.searchParams.set("type", "recovery");
    }
    return NextResponse.redirect(target);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth`);
  }

  return response;
}
