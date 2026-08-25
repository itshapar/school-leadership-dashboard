import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * GET /auth/callback — єдина точка обміну коду на сесію:
 *   • Google OAuth (signInWithOAuth → consent → сюди з ?code=, PKCE)
 *   • підтвердження email після реєстрації (?token_hash=&type=email)
 *   • підтвердження зміни адреси (?token_hash=&type=email_change)
 *   • лист скидання пароля — сюди НЕ доходить, шаблон веде одразу на
 *     /reset-password; але старі листи ще можуть прилетіти, тому нижче
 *     лишається гілка, яка їх переадресовує.
 *
 * ?next приймає ЛИШЕ відносний шлях (анти open-redirect).
 */

/** Типи, які ми реально розсилаємо. Усе інше з ?type= ігноруємо. */
const ALLOWED_OTP_TYPES: EmailOtpType[] = ["email", "email_change", "signup", "invite", "magiclink"];

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

  if (!code && !tokenHash) {
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

  // token_hash — формат наших листів. На відміну від ?code=, він не
  // прив'язаний до code_verifier у localStorage конкретного браузера,
  // тому лист працює й тоді, коли його відкрили на іншому пристрої.
  if (tokenHash) {
    if (!type || !ALLOWED_OTP_TYPES.includes(type as EmailOtpType)) {
      return NextResponse.redirect(`${origin}/admin/login?error=auth`);
    }
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/admin/login?error=auth`);
    }
    return response;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth`);
  }

  return response;
}
