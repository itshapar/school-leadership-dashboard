import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { PublicStudentDashboard } from "@/lib/public/classData";

/**
 * Учнівська сесія «код класу + PIN» (Етап 4).
 *
 * НЕ Supabase Auth: сесія — opaque-токен у httpOnly-cookie, в БД лише
 * sha256-хеш (таблиця student_sessions, міграція 022). Всі перевірки
 * (строк, pin_generation, soft delete) робить SECURITY DEFINER RPC
 * student_dashboard_by_session — бар'єр живе в БД, як після Етапу 1.
 *
 * ВАЖЛИВО: клієнт тут «голий» anon — БЕЗ cookie-контексту вчителя.
 * Роль authenticated свідомо не має EXECUTE на учнівські RPC.
 */

export const STUDENT_SESSION_COOKIE = "sld_student";
/** 400 діб — стеля Chrome для Max-Age; sliding-подовження робить БД. */
export const STUDENT_SESSION_MAX_AGE = 400 * 24 * 60 * 60;

const TOKEN_RE = /^[0-9a-f]{64}$/;

export function bareAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Токен із cookie або null. Формат перевіряємо до походу в БД. */
export async function readStudentSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  if (!token || !TOKEN_RE.test(token)) return null;
  return token;
}

/**
 * Дашборд учня за сесією. null = сесії немає / прострочена / PIN скинуто /
 * учня чи клас видалено — фронт у всіх випадках показує форму PIN.
 */
export async function getStudentDashboardFromSession(): Promise<PublicStudentDashboard | null> {
  const token = await readStudentSessionToken();
  if (!token) return null;

  const supabase = bareAnonClient();
  const { data, error } = await supabase.rpc("student_dashboard_by_session", {
    p_token: token,
  });
  if (error || !data) return null;
  return data as PublicStudentDashboard;
}
