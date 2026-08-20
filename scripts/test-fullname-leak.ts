/**
 * Регресійний тест Етапу 5/6: прізвище учня НЕ залишає кабінет вчителя.
 *
 * Відрізняється від test-anon-leak.ts тим, що не шукає рядок "full_name" у
 * відповіді (це перевіряє лише назву ключа), а бере РЕАЛЬНІ прізвища учнів
 * під service-role і шукає саме їх у публічних видачах. Тобто ловить і той
 * випадок, коли прізвище просочилось під іншим ключем — наприклад, через
 * зміну student_display_name або через порядок слів «Ім'я Прізвище».
 *
 * Що перевіряється:
 *   1. public_class_overview           — публічна сторінка класу;
 *   2. public_student_dashboard        — персональна сторінка (до 024);
 *   3. student_dashboard_by_session    — той самий дашборд за PIN-сесією.
 *
 * Запуск:
 *   npx tsx scripts/test-fullname-leak.ts <КОД_КЛАСУ>
 *
 * Потрібні NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY і
 * SUPABASE_SERVICE_ROLE_KEY у .env.local (service-role — лише щоб дізнатися,
 * ЩО саме шукати; сам пошук іде по відповідях анонімного ключа).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLASS_CODE = (process.argv[2] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

let failures = 0;

/** Спостереження про стан переходу — не впливає на підсумок. */
function note(text: string) {
  console.log(`  ℹ️  ${text}`);
}

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function headersFor(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rest(key: string, pathname: string, init?: RequestInit) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    ...init,
    headers: headersFor(key),
  });
  return { status: res.status, text: await res.text() };
}

/**
 * Прізвище = ПЕРШЕ слово full_name (формат «Прізвище Ім'я», Етап 5).
 * Саме воно не має з'являтися в публічних видачах. Друге слово (ім'я) —
 * навпаки, є очікуваним публічним іменем, тож його не шукаємо.
 */
function surnameOf(fullName: string): string {
  return fullName.replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
}

async function main() {
  if (!URL_BASE || !ANON) {
    console.error("Немає NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(2);
  }
  if (!SERVICE) {
    console.error("Немає SUPABASE_SERVICE_ROLE_KEY — без нього нема з чим звіряти");
    process.exit(2);
  }
  if (!CLASS_CODE) {
    console.error("Вкажи код класу: npx tsx scripts/test-fullname-leak.ts K7M2PQR9TX");
    process.exit(2);
  }

  // 1. Дізнаємось, що саме шукати (service-role, обходить RLS).
  const { text: classText } = await rest(
    SERVICE,
    `classes?select=id,name&public_code=eq.${CLASS_CODE}`
  );
  const classes = JSON.parse(classText) as Array<{ id: string; name: string }>;
  if (classes.length === 0) {
    console.error(`Клас із кодом ${CLASS_CODE} не знайдено`);
    process.exit(2);
  }
  const classId = classes[0].id;

  const { text: studentsText } = await rest(
    SERVICE,
    `students?select=id,full_name&class_id=eq.${classId}&deleted_at=is.null`
  );
  const students = JSON.parse(studentsText) as Array<{ id: string; full_name: string }>;

  if (students.length === 0) {
    console.log(`\n⚠️  У класі ${classes[0].name} немає учнів — перевіряти нічого.\n`);
    process.exit(0);
  }

  const surnames = Array.from(
    new Set(students.map((s) => surnameOf(s.full_name)).filter((s) => s.length >= 3))
  );

  console.log(
    `\n🔍 Клас ${classes[0].name}: ${students.length} учнів, ${surnames.length} унікальних прізвищ для пошуку`
  );

  const findLeaks = (haystack: string) =>
    surnames.filter((surname) => haystack.includes(surname));

  // 2. Публічна сторінка класу.
  console.log("\n🔒 public_class_overview (анонімний ключ)");
  {
    const { status, text } = await rest(ANON, "rpc/public_class_overview", {
      method: "POST",
      body: JSON.stringify({ p_code: CLASS_CODE }),
    });
    check(`HTTP ${status}`, status === 200);
    check("відповідь не порожня", text.trim() !== "null");
    const leaks = findLeaks(text);
    check(
      "жодного прізвища у відповіді",
      leaks.length === 0,
      leaks.length ? `знайдено: ${leaks.slice(0, 3).join(", ")}` : ""
    );
    check("ключа full_name немає", !text.includes("full_name"));
  }

  // 3. Персональна сторінка учня (до застосування 024 доступна anon).
  console.log("\n🔒 public_student_dashboard (анонімний ключ)");
  {
    const { status, text } = await rest(ANON, "rpc/public_student_dashboard", {
      method: "POST",
      body: JSON.stringify({ p_code: CLASS_CODE, p_student_id: students[0].id }),
    });

    if (status === 401 || status === 403 || status === 404) {
      // Очікувано ПІСЛЯ міграції 024: anon втрачає EXECUTE на цю функцію.
      check(`доступ закрито (HTTP ${status}) — міграція 024 застосована`, true);
    } else {
      check(`HTTP ${status}`, status === 200);
      const leaks = findLeaks(text);
      check(
        "жодного прізвища у відповіді",
        leaks.length === 0,
        leaks.length ? `знайдено: ${leaks.slice(0, 3).join(", ")}` : ""
      );
      check("ключа full_name немає", !text.includes("full_name"));
      check("історія підписана типом", text.includes("type_name"));

      // Стан переходу, а не помилка: до застосування 020 RPC свідомо віддає
      // і старий ключ type, і нові type_name/type_icon (сумісність із
      // задеплоєним фронтендом). Після 020 старий ключ має зникнути.
      note(
        /"type"\s*:/.test(text)
          ? "легасі-ключ type ще у видачі — міграція 020 не застосована"
          : "легасі-ключа type немає — міграція 020 застосована"
      );
    }
  }

  // 4. Дашборд за PIN-сесією: та сама видача, окремий шлях доступу.
  console.log("\n🔒 student_dashboard_by_session (анонімний ключ, підроблений токен)");
  {
    const bogusToken = "0".repeat(64);
    const { status, text } = await rest(ANON, "rpc/student_dashboard_by_session", {
      method: "POST",
      body: JSON.stringify({ p_token: bogusToken }),
    });
    check(`HTTP ${status}`, status === 200);
    check("невалідний токен -> null", text.trim() === "null", text.slice(0, 120));
  }

  console.log(
    failures === 0
      ? "\n✅ Прізвища не залишають кабінет вчителя.\n"
      : `\n❌ Провалено перевірок: ${failures}. Публічна видача містить те, чого не мала б.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
