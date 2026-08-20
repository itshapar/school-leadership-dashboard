import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Акцепт Умов вчителем (Етап 5, п. 9; таблиця terms_acceptances з 025).
 *
 * ДВА окремі факти, а не один прапорець:
 *   (а) прийняття Умов і Політики приватності;
 *   (б) окреме запевнення «маю правові підстави вносити дані учнів».
 * Юридично це різні заяви, тому в UI — два ОКРЕМІ чекбокси, обидва обов'язкові.
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
 */
export const TERMS_VERSION = "v1.0";

export const TERMS_ACCEPT_LABEL =
  "Приймаю Умови використання та Політику приватності";

export const DATA_BASIS_ACCEPT_LABEL =
  "Підтверджую, що маю правові підстави для внесення даних учнів і приймаю відповідальність згідно з розділом 5 Умов";

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
