import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getPlatformStats } from "@/lib/admin/platformStats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Вивантаження статистики платформи для особистого дашборда власника (LIFE).
 *
 * Віддає рівно те саме, що бачить сторінка /stats: лише агрегати й назви
 * нагород, жодного імені, нікнейма чи нотатки учня. Службовий ключ Supabase
 * з цього сервера не виходить: LIFE раз на годину стукає сюди зі спільним
 * секретом і кладе знімок у свою базу.
 *
 * Доступ: заголовок `Authorization: Bearer <STATS_EXPORT_SECRET>`.
 * Без змінної середовища або з неправильним секретом відповідь 404, щоб
 * ендпоінт не світився для сторонніх. Порівняння за хешами в сталому часі.
 */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = process.env.STATS_EXPORT_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!expected || expected.length < 32 || !given || !sameSecret(given, expected)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stats = await getPlatformStats();
  if (!stats) {
    return NextResponse.json({ error: "stats_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
