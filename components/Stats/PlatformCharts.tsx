"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlatformStats } from "@/lib/admin/platformStats";

/**
 * Графіки статистики платформи.
 *
 * Клієнтський компонент лише через recharts: сторінка лишається серверною,
 * і жоден службовий ключ у браузер не їде, сюди приходять уже готові числа.
 */

const TOOLTIP = {
  contentStyle: {
    border: "3px solid #000",
    borderRadius: 10,
    fontWeight: 700,
    boxShadow: "3px 3px 0px #000",
  },
};

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="star-card" style={{ padding: 20 }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1rem" }}>{title}</div>
      {hint && (
        <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 2 }}>
          {hint}
        </div>
      )}
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

export default function PlatformCharts({ stats }: { stats: PlatformStats }) {
  const weekly = stats.weekly ?? [];
  const daily = stats.daily ?? [];
  const types = stats.entry_types ?? [];
  const individualPrizes = stats.prizes?.individual_list ?? [];
  const classPrizes = stats.prizes?.class_list ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel
        title="Активність по тижнях"
        hint="Стовпчики, нарахування. Лінія, скільки зірок роздано за тиждень."
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={weekly} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
            <XAxis dataKey="week_label" tick={{ fontWeight: 700, fontSize: 12 }} />
            <YAxis tick={{ fontWeight: 700, fontSize: 12 }} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="entries" name="Нарахувань" fill="#000000" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="stars"
              name="Зірок"
              stroke="#F08C00"
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Нові вчителі по днях" hint="Скільки акаунтів реєструється щодня, за останні 30 днів.">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
            <XAxis dataKey="day_label" interval={2} tick={{ fontWeight: 700, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontWeight: 700, fontSize: 12 }} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="teachers" name="Нових вчителів" fill="#20C31A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Демо по днях" hint="Скільки разів запускали демо-пісочницю, за останні 30 днів.">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
            <XAxis dataKey="day_label" interval={2} tick={{ fontWeight: 700, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontWeight: 700, fontSize: 12 }} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="demos" name="Запусків демо" fill="#7048e8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="За що нараховують" hint="Типи нарахувань і скільки зірок вони принесли.">
        {types.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, types.length * 46)}>
            <BarChart data={types} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontWeight: 700, fontSize: 12 }}
              />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="uses" name="Нарахувань" radius={[0, 6, 6, 0]}>
                {types.map((t, i) => (
                  <Cell key={t.name} fill={t.stars < 0 ? "#fa5252" : i === 0 ? "#000000" : "#F08C00"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Panel
          title="Індивідуальні нагороди"
          hint={`${individualPrizes.length} різних назв у класах вчителів.`}
        >
          <PrizeList items={individualPrizes} />
        </Panel>

        <Panel
          title="Нагороди для всього класу"
          hint={`${classPrizes.length} різних назв у класах вчителів.`}
        >
          <PrizeList items={classPrizes} />
        </Panel>
      </div>
    </div>
  );
}

/**
 * Перелік нагород, а не рейтинг: вчителі називають нагороди надто по-різному,
 * щоб «топ» щось означав. Тут видно, чим люди справді мотивують дітей.
 */
function PrizeList({ items }: { items: Array<{ emoji: string | null; name: string }> }) {
  if (items.length === 0) return <Empty />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 320, overflowY: "auto" }}>
      {items.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "2px solid #000",
            borderRadius: 8,
            padding: "5px 10px",
            fontWeight: 600,
            fontSize: "0.85rem",
          }}
        >
          <span aria-hidden>{p.emoji || "⭐"}</span>
          {p.name}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ fontWeight: 600, color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
      Даних поки немає.
    </div>
  );
}
