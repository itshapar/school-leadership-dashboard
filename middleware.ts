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

  console.log(`[Middleware] Path: ${request.nextUrl.pathname} - Calling supabase.auth.getUser()...`);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(`[Middleware] Path: ${request.nextUrl.pathname} - User: ${user ? user.email : 'null'}`);

  const isApiAdminRoute = request.nextUrl.pathname.startsWith("/api/admin");
  const isAdminRoute =
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login");

  if ((isAdminRoute || isApiAdminRoute) && !user) {
    console.log(`[Middleware] Redirecting to login: ${request.nextUrl.pathname}`);
    if (isApiAdminRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  console.log(`[Middleware] Request allowed: ${request.nextUrl.pathname}`);
  return supabaseResponse;
}

export const config = {
  // /api/admin — щоб оновлювати сесію Supabase на кожному запиті до API (без редіректу: шлях не під /admin)
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
