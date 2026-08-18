import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Жодного логування email/uid: логи Vercel зберігаються й доступні ширшому
  // колу, ніж самі дані. Раніше сюди на кожен запит писався email користувача.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isApiAdminRoute = pathname.startsWith("/api/admin");
  const isAdminRoute =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  // /dashboard — повна аналітика по всіх класах; була доступна без логіну.
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if ((isAdminRoute || isApiAdminRoute || isDashboardRoute) && !user) {
    if (isApiAdminRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // /api/admin — щоб оновлювати сесію Supabase на кожному запиті до API (без редіректу: шлях не під /admin)
  matcher: ["/admin/:path*", "/api/admin/:path*", "/dashboard/:path*"],
};
