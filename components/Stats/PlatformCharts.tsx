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
  const prizes = stats.prizes?.top_given ?? [];
  const types = stats.entry_types ?? [];

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

      <Panel title="Нові вчителі по тижнях" hint="Скільки акаунтів реєструється щотижня.">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekly} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
            <XAxis dataKey="week_label" tick={{ fontWeight: 700, fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontWeight: 700, fontSize: 12 }} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="teachers" name="Нових вчителів" fill="#20C31A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Panel title="Які нагороди видають" hint="Скільки разів нагороду реально вручили учням.">
          {prizes.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prizes.map((p, i) => {
                const max = prizes[0].given || 1;
                return (
                  <div key={`${p.name}-${i}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.9rem" }}>
                      <span>
                        {p.emoji} {p.name}
                      </span>
                      <span>{p.given}</span>
                    </div>
                    <div style={{ height: 10, background: "#f1f3f5", borderRadius: 6, marginTop: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.max(4, (p.given / max) * 100)}%`,
                          height: "100%",
                          background: "var(--color-star)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      </div>

      <Panel title="Найпопулярніші нагороди в налаштуваннях" hint="Скільки класів завели таку нагороду і за скільки зірок у середньому.">
        {stats.prizes.top_defined.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", fontWeight: 900, textTransform: "uppercase", fontSize: "0.75rem" }}>
                  <th style={{ padding: "8px 6px" }}>Нагорода</th>
                  <th style={{ padding: "8px 6px" }}>Класів</th>
                  <th style={{ padding: "8px 6px" }}>Поріг, зірок</th>
                </tr>
              </thead>
              <tbody>
                {stats.prizes.top_defined.map((p, i) => (
                  <tr key={`${p.name}-${i}`} style={{ borderTop: "2px solid #f1f3f5", fontWeight: 700 }}>
                    <td style={{ padding: "8px 6px" }}>
                      {p.emoji} {p.name}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{p.classes}</td>
                    <td style={{ padding: "8px 6px" }}>{p.avg_stars}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
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
