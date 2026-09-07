"use client";

import { useMemo, useState } from "react";
import type { PrizeUsageRow } from "@/lib/admin/platformStats";
import StarIcon from "@/components/StarIcon";

/**
 * Табличка нагород, які вчителі завели у своїх класах.
 *
 * Раніше тут лежала купка бейджиків із самими назвами: видно, що люди
 * вигадують, і не видно, що з цього справді працює. Тепер один рядок, це
 * одна назва по всій платформі: яку іконку до неї ставлять, за скільки
 * зірок, у скількох класах вона є і скільки учнів (або класів) до неї вже
 * дійшли.
 *
 * Назви групуються без урахування регістру, тож «Піца» і «піца» це один
 * рядок. Іконка й написання показані ті, що трапляються частіше.
 *
 * Сортування клієнтське: колонок п'ять, і кожна відповідає на своє питання,
 * тож нав'язувати один «правильний» порядок немає сенсу. За замовчуванням
 * зверху найужитковіші, як їх і віддає RPC.
 */

type SortKey = "name" | "stars" | "classes" | "result" | "progress";

interface ColumnDef {
  key: SortKey;
  label: string;
  hint?: string;
}

function formatStars(row: PrizeUsageRow): string | null {
  if (row.stars_min == null || row.stars_max == null) return null;
  // Один поріг чи діапазон: той самий «Кіндер» в одному класі коштує 10
  // зірок, а в іншому 30, і склеювати це в одне число було б брехнею.
  return row.stars_min === row.stars_max
    ? `${row.stars_min}`
    : `${row.stars_min}–${row.stars_max}`;
}

function Num({ value, muted }: { value: number | null | undefined; muted?: boolean }) {
  if (value == null) return <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>—</span>;
  return (
    <span
      style={{
        fontWeight: 900,
        color: value === 0 || muted ? "var(--color-text-muted)" : "var(--color-text)",
      }}
    >
      {value}
    </span>
  );
}

export default function PrizeUsageTable({
  rows,
  kind,
}: {
  rows: PrizeUsageRow[];
  /** Індивідуальна нагорода йде учневі, класова, усьому класу. */
  kind: "individual" | "class";
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const columns: ColumnDef[] = useMemo(
    () =>
      kind === "individual"
        ? [
            { key: "name", label: "Нагорода" },
            { key: "stars", label: "Зірок" },
            { key: "classes", label: "Класів" },
            { key: "result", label: "Отримали", hint: "учнів" },
          ]
        : [
            { key: "name", label: "Нагорода" },
            { key: "stars", label: "Поріг" },
            { key: "classes", label: "Класів" },
            { key: "result", label: "Назбирали", hint: "класів" },
            { key: "progress", label: "Найкращий", hint: "прогрес класу" },
          ],
    [kind]
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const value = (r: PrizeUsageRow): number | string => {
      switch (sort.key) {
        case "name":
          return r.name.toLowerCase();
        case "stars":
          return r.stars_min ?? -1;
        case "classes":
          return r.classes ?? -1;
        case "result":
          return (kind === "individual" ? r.given : r.reached) ?? -1;
        case "progress":
          return r.best_progress ?? -1;
      }
    };
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv), "uk") * factor;
      }
      return (av - bv) * factor;
    });
  }, [rows, sort, kind]);

  if (rows.length === 0) {
    return (
      <div style={{ fontWeight: 600, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        Даних поки немає.
      </div>
    );
  }

  const toggle = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : // Назву логічно читати від «А», числа, від найбільшого.
          { key, dir: key === "name" ? "asc" : "desc" }
    );

  return (
    <div style={{ maxHeight: 460, overflow: "auto" }}>
      <table className="prize-usage-table">
        <thead>
          <tr>
            <th style={{ width: 44 }} aria-label="Іконка" />
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={c.key === "name" ? "col-name" : "col-num"}
                title="Натисніть, щоб відсортувати"
              >
                {c.label}
                {sort?.key === c.key && <span className="sort-mark">{sort.dir === "asc" ? "↑" : "↓"}</span>}
                {c.hint && <div className="col-hint">{c.hint}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const stars = formatStars(row);
            return (
              <tr key={`${row.name}-${i}`}>
                <td className="cell-emoji" aria-hidden>
                  {row.emoji || "⭐"}
                </td>
                <td className="col-name">{row.name}</td>
                <td className="col-num">
                  {stars ? (
                    <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                      {stars} <StarIcon size="0.85rem" />
                    </span>
                  ) : (
                    <Num value={null} />
                  )}
                </td>
                <td className="col-num">
                  <Num value={row.classes} />
                </td>
                <td className="col-num">
                  <Num value={kind === "individual" ? row.given : row.reached} />
                </td>
                {kind === "class" && (
                  <td className="col-num">
                    {row.best_progress == null ? (
                      <Num value={null} />
                    ) : (
                      <span style={{ fontWeight: 800, color: row.best_progress >= 100 ? "#20C31A" : "var(--color-text-muted)" }}>
                        {row.best_progress}%
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <style jsx>{`
        .prize-usage-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .prize-usage-table th {
          position: sticky;
          top: 0;
          background: var(--bg-card);
          z-index: 1;
          text-align: right;
          padding: 8px 10px;
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--color-text-muted);
          border-bottom: 2px solid var(--color-border);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .prize-usage-table th:hover {
          color: var(--color-text);
        }
        .prize-usage-table th.col-name {
          text-align: left;
        }
        .col-hint {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0;
          text-transform: none;
        }
        .sort-mark {
          margin-left: 4px;
        }
        .prize-usage-table td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--color-border);
          text-align: right;
          vertical-align: middle;
        }
        .prize-usage-table tr:last-child td {
          border-bottom: none;
        }
        .prize-usage-table td.col-name {
          text-align: left;
          font-weight: 600;
          /* Назви бувають на пів речення, тож рядок тримаємо, а не розсовуємо
             таблицю по горизонталі. */
          overflow-wrap: anywhere;
        }
        .cell-emoji {
          font-size: 1.25rem;
          text-align: center !important;
          padding-right: 0 !important;
        }
      `}</style>
    </div>
  );
}
