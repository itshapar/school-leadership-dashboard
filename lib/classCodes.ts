export interface ClassCodeItem {
  id: string;
}

function hashToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export function buildClassCodeMap(items: ClassCodeItem[]): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};

  for (const item of items) {
    const base = hashToInt(item.id) % 10000;
    let probe = 0;
    let code = "";
    while (probe < 10000) {
      code = String((base + probe) % 10000).padStart(4, "0");
      if (!used.has(code)) break;
      probe += 1;
    }
    used.add(code);
    out[item.id] = code;
  }

  return out;
}

export function resolveClassIdByCode(items: ClassCodeItem[], code: string): string | null {
  if (!/^\d{4}$/.test(code)) return null;
  const map = buildClassCodeMap(items);
  for (const item of items) {
    if (map[item.id] === code) return item.id;
  }
  return null;
}
