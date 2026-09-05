import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlatformStats } from "@/lib/admin/platformStats";
import PlatformCharts from "@/components/Stats/PlatformCharts";
import StarIcon from "@/components/StarIcon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Статистика платформи · StarBoard",
  robots: { index: false, follow: false },
};

/**
 * Статистика платформи: скільки вчителів приходить, як вони користуються
 * продуктом, що нараховують і які нагороди заводять у класах.
 *
 * Доступ закритий подвійно, і це навмисно:
 *   • сторінка вимагає ролі platform_role=admin у app_metadata (міграція
 *     023). Метадані app_metadata користувач змінити не може, вони живуть у
 *     JWT і виставляються тільки службовим ключем;
 *   • сам RPC platform_stats_full відданий ЛИШЕ ролі service_role, тож
 *     звичайний вчитель не дістане цифр навіть в обхід сторінки.
 *
 * Чужому віддаємо 404, а не «доступ заборонено»: сторінки, про існування
 * якої ніхто не знає, простіше не мати в чужій голові взагалі.
 *
 * Коли захочете зробити статистику публічною, досить прибрати перевірку
 * ролі нижче: даних учнів тут немає за побудовою, лише агрегати.
 */
export default async function PlatformStatsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPlatformAdmin =
    (user?.app_metadata as { platform_role?: string } | undefined)?.platform_role === "admin";
  if (!isPlatformAdmin) return notFound();

  const stats = await getPlatformStats();
  if (!stats) return notFound();

  const kpi = [
    { label: "Вчителів", value: stats.teachers.total, hint: `+${stats.teachers.new_7d} за тиждень`, accent: "#000000" },
    { label: "Активні за тиждень", value: stats.teachers.active_7d, hint: "нараховували зірки", accent: "#20C31A" },
    { label: "Дітей у класах", value: stats.students.total, hint: `${stats.students.logged_in_ever} заходили самі`, accent: "#228be6" },
    { label: "Класів", value: stats.classes.active, hint: `у середньому ${stats.classes.avg_students ?? 0} учнів`, accent: "#000000" },
    { label: "Зірок роздано", value: stats.activity.stars_total, hint: `${stats.activity.entries_total} нарахувань`, accent: "#F08C00" },
    { label: "Нагород вручено", value: stats.prizes.given_total, hint: `${stats.prizes.individual_defined} заведено в класах`, accent: "#F08C00" },
    { label: "Уроків проведено", value: stats.activity.lessons, hint: `${stats.activity.entries_7d} нарахувань за тиждень`, accent: "#000000" },
    {
      label: "Демо за добу",
      value: stats.demo.sessions_24h,
      hint: `${stats.demo.sessions_7d} за тиждень · ${stats.demo.live_now} зараз у демо`,
      accent: "#7048e8",
    },
  ];

  // Журнал запусків демо завели в міграції 046, і до неї історії не існувало:
  // анонімні сесії прибирає pg_cron через 6 годин. Поки журналу менше тижня,
  // числа «за тиждень» і «за місяць» неповні, і про це чесніше сказати.
  const demoTrackedSince = stats.demo.tracking_since ? new Date(stats.demo.tracking_since) : null;
  const demoTrackingIsYoung =
    !demoTrackedSince || Date.now() - demoTrackedSince.getTime() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="page-container" style={{ maxWidth: "1000px", paddingBottom: "60px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <StarIcon size="1.5rem" />
          <span style={{ fontSize: "1rem", fontWeight: 900, textTransform: "uppercase" }}>StarBoard</span>
        </div>
        <h1
          style={{
            margin: "10px 0 0",
            fontSize: "2.2rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "-1px",
          }}
        >
          Статистика платформи
        </h1>
        <div style={{ marginTop: 6, color: "var(--color-text-muted)", fontWeight: 600, fontSize: "0.85rem" }}>
          Оновлено {new Date(stats.generated_at).toLocaleString("uk-UA")} · демо-гості, демо-класи і
          службові акаунти в числа не входять
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {kpi.map((k) => (
          <div key={k.label} className="star-card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {k.label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1.1, color: k.accent, marginTop: 6 }}>
              {k.value.toLocaleString("uk-UA")}
            </div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-text-muted)", marginTop: 4 }}>
              {k.hint}
            </div>
          </div>
        ))}
      </div>

      <PlatformCharts stats={stats} />

      {demoTrackingIsYoung && (
        <div
          className="star-card"
          style={{ marginTop: 16, padding: 18, fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.6 }}
        >
          Запуски демо рахуються з{" "}
          {demoTrackedSince ? demoTrackedSince.toLocaleDateString("uk-UA") : "моменту, коли з'явиться перший гість"}
          . Раніше сліду не лишалося: анонімні сесії прибираються через 6 годин, тож усе, що було до
          цієї дати, не відновити.
        </div>
      )}

      <div className="star-card" style={{ marginTop: 16, padding: 18, fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.6 }}>
        Тут немає жодного імені учня, нікнейма чи нотатки: сторінка бачить лише лічильники й назви
        нагород. Тому її можна буде відкрити публічно, коли захочете показувати цифри зростання.
        {stats.activity.penalties > 0 && (
          <>
            {" "}
            Мінусових записів усього {stats.activity.penalties}, це переважно позначки «Н» за
            відсутність, а не штрафи.
          </>
        )}
      </div>
    </div>
  );
}
