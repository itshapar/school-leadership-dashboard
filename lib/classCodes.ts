/**
 * Публічні коди класів.
 *
 * Раніше код рахувався в рантаймі як FNV-hash від class id по модулю 10000
 * (4 цифри) — це означало 10 000 варіантів перебору і залежність від того,
 * який саме набір класів встиг завантажитись. Тепер код зберігається в БД
 * (`classes.public_code`), генерується криптостійко і має 10 символів
 * з алфавіту без неоднозначних гліфів.
 *
 * Тут лишається тільки нормалізація/валідація/форматування — жодних
 * запитів до БД і жодного резолву на клієнті.
 */

/** 31 символ: A-Z без I, L, O + цифри 2-9 (без 0 та 1). */
export const CLASS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CLASS_CODE_LENGTH = 10;

const CODE_RE = new RegExp(`^[${CLASS_CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`);
const LEGACY_CODE_RE = /^\d{4}$/;

/** "k7m2p-qr9tx" | "K7M2P QR9TX" -> "K7M2PQR9TX" */
export function normalizeClassCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "K7M2PQR9TX" -> "K7M2P-QR9TX" (для показу вчителю та друку) */
export function formatClassCode(raw: string | null | undefined): string {
  const code = normalizeClassCode(raw);
  return code.length === CLASS_CODE_LENGTH
    ? `${code.slice(0, 5)}-${code.slice(5)}`
    : code;
}

export function isCurrentClassCode(raw: string | null | undefined): boolean {
  return CODE_RE.test(normalizeClassCode(raw));
}

/** Старий 4-значний код — лишається робочим як redirect на новий. */
export function isLegacyClassCode(raw: string | null | undefined): boolean {
  return LEGACY_CODE_RE.test(normalizeClassCode(raw));
}

/**
 * Чи взагалі варто йти в БД із цим параметром URL.
 * Відсікає сміття до запиту, щоб не робити зайвих викликів RPC.
 */
export function isPlausibleClassCode(raw: string | null | undefined): boolean {
  return isCurrentClassCode(raw) || isLegacyClassCode(raw);
}
