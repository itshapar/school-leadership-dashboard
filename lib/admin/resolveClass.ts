import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeClassCode } from "@/lib/classCodes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Резолв параметра /admin/[classId]: приймає або UUID, або публічний код.
 *
 * Запит іде під сесією вчителя, тому RLS уже відсіює чужі класи — якщо
 * вчитель не власник, повернеться null і сторінка віддасть notFound().
 * Раніше код резолвився в пам'яті з повного списку класів (hash від id),
 * що вимагало читати всі класи і давало інші коди залежно від того, скільки
 * класів встигло завантажитись.
 */
export async function resolveOwnedClass(
  supabase: SupabaseClient,
  param: string
): Promise<{ id: string; name: string; public_code: string } | null> {
  const query = supabase.from("classes").select("id, name, public_code");

  const { data, error } = UUID_RE.test(param)
    ? await query.eq("id", param).maybeSingle()
    : await query.eq("public_code", normalizeClassCode(param)).maybeSingle();

  if (error || !data) return null;
  return data as { id: string; name: string; public_code: string };
}
