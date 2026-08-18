/**
 * Перевірка, що публічний (anon) ключ більше нічого не віддає.
 *
 * Запуск:
 *   npx tsx scripts/test-anon-leak.ts <КОД_КЛАСУ>
 *   (або npx ts-node --esm scripts/test-anon-leak.ts <КОД_КЛАСУ>)
 *
 * Читає NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_ANON_KEY з .env.local.
 * Той самий набір перевірок, що в docs/SECURITY_VERIFICATION.md, але одним
 * прогоном і з зеленим/червоним підсумком.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CLASS_CODE = (process.argv[2] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const TABLES = [
  "students",
  "classes",
  "lessons",
  "star_entries",
  "prizes_individual",
  "prizes_given",
  "class_prizes_given",
];

const headers = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
  "Content-Type": "application/json",
};

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rest(pathname: string, init?: RequestInit) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, { ...init, headers });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  if (!URL_BASE || !ANON) {
    console.error("Немає NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(2);
  }

  console.log("\n🔒 Читання таблиць анонімом (має бути відмова або порожньо)");
  for (const t of TABLES) {
    const { status, text } = await rest(`${t}?select=*&limit=1`);
    const denied = status === 401 || status === 403;
    const empty = status === 200 && text.trim() === "[]";
    check(`${t}: HTTP ${status}`, denied || empty, denied ? "" : text.slice(0, 100));
  }

  console.log("\n🔒 Запис анонімом (має бути відмова)");
  {
    const { status } = await rest("classes", {
      method: "POST",
      body: JSON.stringify({ name: "pwned-by-anon-test" }),
    });
    check(`INSERT classes: HTTP ${status}`, status >= 400);
  }

  console.log("\n🔒 Внутрішні функції недоступні анонімом");
  {
    const { status } = await rest("rpc/resolve_class_by_code", {
      method: "POST",
      body: JSON.stringify({ p_code: CLASS_CODE || "AAAAAAAAAA" }),
    });
    check(`rpc/resolve_class_by_code: HTTP ${status}`, status >= 400);
  }

  console.log("\n🔒 Перебір кодів нічого не дає");
  for (const bogus of ["QQQQQQQQQQ", "AAAAAAAAAA", "0000", "9999", ""]) {
    const { text } = await rest("rpc/public_class_overview", {
      method: "POST",
      body: JSON.stringify({ p_code: bogus }),
    });
    check(`code "${bogus}" -> ${text.trim()}`, text.trim() === "null");
  }

  if (!CLASS_CODE) {
    console.log("\n⚠️  Код класу не переданий — пропускаю позитивні перевірки RPC.");
    console.log("    Запусти як: npx tsx scripts/test-anon-leak.ts K7M2PQR9TX\n");
  } else {
    console.log("\n✅ Публічна сторінка класу все ще працює — і без ПІБ");
    const { status, text } = await rest("rpc/public_class_overview", {
      method: "POST",
      body: JSON.stringify({ p_code: CLASS_CODE }),
    });
    check(`rpc/public_class_overview: HTTP ${status}`, status === 200);
    check("відповідь не порожня", text.trim() !== "null", text.slice(0, 120));
    check("немає full_name у відповіді", !text.includes("full_name"));
    check("є display_name", text.includes("display_name"));

    const bogusStudent = "11111111-2222-3333-4444-555555555555";
    const { text: st } = await rest("rpc/public_student_dashboard", {
      method: "POST",
      body: JSON.stringify({ p_code: CLASS_CODE, p_student_id: bogusStudent }),
    });
    check("чужий/неіснуючий student_id -> null", st.trim() === "null", st.slice(0, 120));
  }

  console.log(
    failures === 0
      ? "\n🎉 Усі перевірки пройдено — витік закрито.\n"
      : `\n🚨 Провалено перевірок: ${failures}. Витік НЕ закрито повністю.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
