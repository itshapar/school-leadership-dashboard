import { NextResponse, type NextRequest } from "next/server";
import { bareAnonClient, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";

/** POST /api/student/logout — вихід учня: сесія стирається в БД, cookie гаситься. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;

  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const supabase = bareAnonClient();
    // Помилку ігноруємо свідомо: cookie все одно гаситься нижче.
    await supabase.rpc("student_logout", { p_token: token });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDENT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
