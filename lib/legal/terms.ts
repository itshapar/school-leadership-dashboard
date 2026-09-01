import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Акцепт Умов вчителем (Етап 5, п. 9; таблиця terms_acceptances з 025).
 *
 * ДВА окремі факти зберігаються в БД, а не один прапорець:
 *   (а) прийняття Умов і Політики приватності;
 *   (б) окреме запевнення «маю правові підстави вносити дані учнів».
 * Юридично це різні заяви — обидва boolean-поля пишуться завжди РАЗОМ.
 *
 * Етап 9: в UI лишили ОДИН чекбокс замість двох (продукт-фідбек: два
 * окремих клікі виглядали як зайва плутанина). Обидва факти й далі
 * зафіксовані — просто текст (б) переїхав з другого чекбокса в дрібний
 * підпис під єдиним чекбоксом, а не зник.
 *
 * Три шляхи фіксації, бо жоден не покриває всі випадки:
 *   • email-реєстрація → метадані signUp → тригер handle_new_user (025);
 *   • Google OAuth     → метаданих форми немає → guard у кабінеті;
 *   • наявний акаунт або НОВА версія Умов → той самий guard.
 */

/**
 * Версія Умов. Змінити тут → TermsGate попросить акцепт заново в усіх
 * вчителів, бо terms_acceptances ключується парою (user_id, версія).
 * Це єдиний перемикач переакцепту — жодних міграцій для цього не треба.
 *
 * v1.1 (1 вересня 2026): реєстрація без підтвердження пошти, демо-режим на
 * тимчасовому анонімному акаунті, реальні канали підтримки замість адреси,
 * якої не існувало. Зміни змістовні, тому версію піднято.
 */
export const TERMS_VERSION = "v1.1";

/** Дрібний підпис під чекбоксом: юридичний зміст (б), який не зник, а став текстом. */
export const COMBINED_ACCEPT_SUBTEXT =
  "Реєструючись, ви також підтверджуєте, що маєте правові підстави вносити дані учнів і приймаєте відповідальність згідно з розділом 5 Умов.";

/** Чи прийняв поточний вчитель ПОТОЧНУ версію Умов. */
export async function hasAcceptedCurrentTerms(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("id")
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();

  // Помилку трактуємо як «не прийняв»: краще зайвий раз показати модалку,
  // ніж мовчки пропустити вчителя повз акцепт.
  if (error) return false;
  return Boolean(data);
}

/**
 * Записати акцепт. RPC — SECURITY INVOKER, тобто INSERT іде під RLS вчителя:
 * чужий рядок не запишеш навіть підробленим тілом запиту.
 */
export async function recordTermsAcceptance(
  supabase: SupabaseClient,
  source: "oauth" | "guard" = "guard"
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("record_terms_acceptance", {
    p_version: TERMS_VERSION,
    p_data_basis: true,
    p_source: source,
  });
  return { error: error?.message };
}

/** Метадані для supabase.auth.signUp — їх підбирає тригер handle_new_user. */
export function signUpTermsMetadata() {
  return {
    terms_version: TERMS_VERSION,
    accepted_terms: "true",
    accepted_data_basis: "true",
  };
}
