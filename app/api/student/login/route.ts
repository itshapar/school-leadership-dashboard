import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  bareAnonClient,
  STUDENT_SESSION_COOKIE,
  STUDENT_SESSION_MAX_AGE,
} from "@/lib/studentSession";
import { normalizeClassCode, isPlausibleClassCode } from "@/lib/classCodes";

/**
 * POST /api/student/login — вхід учня «код класу + PIN».
 *
 * Уся логіка (resolve коду, bcrypt-перевірка, rate limiting, створення
 * сесії) — в SECURITY DEFINER RPC student_login (міграція 022). Route
 * handler лише валідує вхід, передає реальний IP і ставить httpOnly-cookie.
 *
 * Відповіді не розрізняють «невідомий код» і «невірний PIN» — 401 'invalid'
 * для обох (анти-enumeration).
 */

const BodySchema = z.object({
  code: z.string().min(1).max(32),
  pin: z.string().regex(/^\d{6}$/),
});

// Простий формат-чек IP: не пускаємо в inet-параметр довільні заголовки.
const IP_RE = /^[0-9a-fA-F.:]{3,45}$/;

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = (fwd ?? "").split(",")[0]?.trim() ?? "";
  return IP_RE.test(ip) ? ip : null;
}

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  if (!isPlausibleClassCode(parsed.code)) {
    // Формат коду свідомо неможливий — не витрачаємо запит у БД,
    // відповідь та сама, що й для невірного PIN.
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  const supabase = bareAnonClient();
  const { data, error } = await supabase.rpc("student_login", {
    p_code: normalizeClassCode(parsed.code),
    p_pin: parsed.pin,
    p_ip: clientIp(request),
  });

  if (error || !data) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 401 });
  }

  const result = data as
    | { ok: true; token: string; student_id: string; expires_at: string }
    | { ok: false; reason: "invalid" | "rate_limited" };

  if (!result.ok) {
    const status = result.reason === "rate_limited" ? 429 : 401;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDENT_SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_SESSION_MAX_AGE,
  });
  return response;
}
