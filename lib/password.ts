/**
 * Проста клієнтська оцінка надійності пароля (Етап 9).
 *
 * Не заміна серверної перевірки Supabase (min length, leaked password
 * protection) — лише візуальна підказка вчителю ДО сабміту. 0–4 бали:
 * довжина ≥8, ≥12, різний регістр, цифра, символ (максимум по одному балу
 * за кожен пункт, підсумок обрізаний до 4).
 */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

export function scorePassword(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-zа-яіїєґ]/i.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^a-zа-яіїєґ0-9]/i.test(password)) score += 1;

  const clamped = Math.min(score, 4) as PasswordStrength["score"];
  const levels: Array<{ label: string; color: string }> = [
    { label: "Дуже слабкий", color: "#e03131" },
    { label: "Слабкий", color: "#e8590c" },
    { label: "Середній", color: "#f08c00" },
    { label: "Надійний", color: "#20C31A" },
    { label: "Дуже надійний", color: "#20C31A" },
  ];
  return { score: clamped, ...levels[clamped] };
}
