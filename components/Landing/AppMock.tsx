import {
  ArrowLeft,
  ChartLine,
  ClockCounterClockwise,
  Gear,
  Gift,
  Lock,
  Plus,
  QrCode,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import { LandingStar } from "@/components/Landing/LandingArt";

/**
 * Макети реальних екранів StarBoard для лендінгу.
 *
 * Це навмисно HTML, а не намальовані SVG: екрани відтворюються тими самими
 * токенами, що й сам застосунок (чорна обводка, квадратна тінь, Montserrat
 * 600/800/900, зелений #20C31A, зірковий #F08C00), тож лендінг показує
 * продукт, а не його ілюстрацію. Числа й імена, звісно, вигадані.
 *
 * Звідки взято кожну деталь:
 *   Журнал        components/Admin/ManagementTable.tsx (колонки #, УЧЕНЬ,
 *                 ВСЬОГО, нагороди-чекбокси, уроки зі значеннями 0/Н/1/2/3,
 *                 сіра підсвітка сьогоднішнього уроку, підсумковий рядок
 *                 через чорну лінію 3px)
 *   Нарахування   components/Admin/QuickEntry.tsx (поля Тип нарахування,
 *                 Кому призначити, Учень, Скільки зірок, Нотатка)
 *   Аналітика     components/dashboard/widgets/LeaderboardWidget.tsx і
 *                 dashboard.css (.bento-widget, .leaderboard-item)
 *   Сторінка учня components/PersonalDashboardClient.tsx (аватар, зірки,
 *                 ранг, картка приватності, ПРОГРЕС НАГОРОД, ІСТОРІЯ ЗІРОК)
 *
 * Усі чотири, серверні компоненти без стану. Перемикання між ними на
 * лендінгу зроблено на CSS (радіо-кнопки + :checked), тож клієнтського JS
 * на сторінці немає.
 */

/* ------------------------------------------------------------------ */
/* Журнал класу                                                        */
/* ------------------------------------------------------------------ */

const JOURNAL_STUDENTS = [
  { avatar: "🦊", name: "Бондаренко Оксана", nick: "оксі", total: 13, prizes: [true, false], scores: [1, 2, 1] },
  { avatar: "🐼", name: "Ковальчук Данило", nick: null, total: 11, prizes: [false, false], scores: [1, 0, 2] },
  { avatar: "🦉", name: "Литвин Марія", nick: "мія", total: 12, prizes: [true, false], scores: [2, 1, 1] },
  { avatar: "🐨", name: "Савченко Артем", nick: null, total: 9, prizes: [false, false], scores: [0, -1, 2] },
];

/** Значення уроку показується так само, як у журналі: −1 читається як «Н». */
function scoreLabel(score: number) {
  if (score < 0) return "Н";
  return String(score);
}

function scoreClass(score: number) {
  if (score > 0) return "lp-m-score lp-m-score-plus";
  if (score < 0) return "lp-m-score lp-m-score-minus";
  return "lp-m-score lp-m-score-zero";
}

export function JournalMock() {
  const lessons = ["12.09", "19.09", "26.09"];

  return (
    <div className="lp-mock">
      <div className="lp-mock-bar">
        <span className="lp-m-back" aria-hidden="true">
          <ArrowLeft weight="bold" />
        </span>
        <span className="lp-m-bar-divider" aria-hidden="true" />
        <span className="lp-m-title">7-А</span>
        <span className="lp-m-tools" aria-hidden="true">
          <span className="lp-m-icon-btn">
            <Plus weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <ClockCounterClockwise weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <Users weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <Gift weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <Gear weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <ChartLine weight="bold" />
          </span>
          <span className="lp-m-icon-btn">
            <QrCode weight="bold" />
          </span>
        </span>
      </div>

      <div className="lp-m-scroll">
        <table className="lp-m-table">
          <thead>
            <tr>
              <th className="lp-m-center">#</th>
              <th>УЧЕНЬ</th>
              <th className="lp-m-center">ВСЬОГО</th>
              <th className="lp-m-center">КІНДЕР</th>
              <th className="lp-m-center">3Д ДРУК</th>
              {lessons.map((d, i) => (
                <th key={d} className={`lp-m-center${i === lessons.length - 1 ? " lp-m-today" : ""}`}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JOURNAL_STUDENTS.map((s, i) => (
              <tr key={s.name}>
                <td className="lp-m-center lp-m-index">{i + 1}</td>
                <td>
                  <span className="lp-m-student">
                    <span className="lp-m-avatar" aria-hidden="true">
                      {s.avatar}
                    </span>
                    <span>
                      <span className="lp-m-name">{s.name}</span>
                      {s.nick && <span className="lp-m-nick">{s.nick}</span>}
                    </span>
                  </span>
                </td>
                <td className="lp-m-center">
                  <span className="lp-m-total">{s.total}</span>
                </td>
                {s.prizes.map((given, p) => (
                  <td key={p} className="lp-m-center">
                    <span className={given ? "lp-m-check lp-m-check-on" : "lp-m-check"} aria-hidden="true" />
                  </td>
                ))}
                {s.scores.map((score, l) => (
                  <td
                    key={l}
                    className={`lp-m-center${l === s.scores.length - 1 ? " lp-m-today" : ""}`}
                  >
                    <span className={scoreClass(score)}>{scoreLabel(score)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Нарахування поза уроком                                             */
/* ------------------------------------------------------------------ */

export function EntryMock() {
  return (
    <div className="lp-mock lp-mock-modal">
      <div className="lp-m-modal-title">Нарахування</div>

      <div className="lp-m-field">
        <span className="lp-m-label">Тип нарахування</span>
        <span className="lp-m-input">🎁 Бонус · +</span>
      </div>

      <div className="lp-m-field">
        <span className="lp-m-label">Кому призначити?</span>
        <span className="lp-m-segment" aria-hidden="true">
          <span className="lp-m-seg lp-m-seg-on">Учню</span>
          <span className="lp-m-seg">Усьому класу</span>
        </span>
      </div>

      <div className="lp-m-field">
        <span className="lp-m-label">Учень</span>
        <span className="lp-m-input">🦊 Бондаренко Оксана (оксі)</span>
      </div>

      <div className="lp-m-field">
        <span className="lp-m-label">Скільки зірок</span>
        <span className="lp-m-input lp-m-input-addon">
          2
          <span className="lp-m-addon" aria-hidden="true">
            <LandingStar size="1em" />
          </span>
        </span>
      </div>

      <div className="lp-m-field">
        <span className="lp-m-label">Нотатка</span>
        <span className="lp-m-input">Допомогла з проєктом</span>
      </div>

      <div className="lp-m-modal-actions" aria-hidden="true">
        <span className="lp-m-btn lp-m-btn-white">Скасувати</span>
        <span className="lp-m-btn lp-m-btn-black">Зберегти</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Аналітика                                                           */
/* ------------------------------------------------------------------ */

const LEADERBOARD = [
  { rank: 1, avatar: "🦊", name: "Оксі", full: "Бондаренко Оксана", stars: 13, trend: 3 },
  { rank: 2, avatar: "🦉", name: "Мія", full: "Литвин Марія", stars: 12, trend: 1 },
  { rank: 3, avatar: "🐼", name: "Ковальчук Данило", full: null, stars: 11, trend: 0 },
  { rank: 4, avatar: "🐨", name: "Савченко Артем", full: null, stars: 9, trend: -1 },
];

const EFFICIENCY = [
  { avatar: "🦊", name: "Оксі", value: 92 },
  { avatar: "🦉", name: "Мія", value: 84 },
  { avatar: "🐼", name: "Данило", value: 71 },
  { avatar: "🐨", name: "Артем", value: 58 },
];

export function AnalyticsMock() {
  return (
    <div className="lp-m-bento">
      <div className="lp-mock lp-mock-widget">
        <div className="lp-m-widget-title">Рейтинг класу</div>
        <div className="lp-m-lb">
          {LEADERBOARD.map((s) => (
            <div className="lp-m-lb-item" key={s.rank}>
              <span className={`lp-m-lb-rank lp-m-rank-${s.rank}`}>{s.rank}</span>
              <span className="lp-m-lb-avatar" aria-hidden="true">
                {s.avatar}
              </span>
              <span className="lp-m-lb-name">
                <span className="lp-m-name">{s.name}</span>
                {s.full && <span className="lp-m-nick">{s.full}</span>}
              </span>
              <span className="lp-m-lb-right">
                <span className="lp-m-lb-stars">
                  {s.stars} <LandingStar size="0.95em" />
                </span>
                <span
                  className={
                    s.trend > 0
                      ? "lp-m-trend lp-m-trend-up"
                      : s.trend < 0
                        ? "lp-m-trend lp-m-trend-down"
                        : "lp-m-trend"
                  }
                >
                  {s.trend > 0 ? `▲ ${s.trend}` : s.trend < 0 ? `▼ ${Math.abs(s.trend)}` : "–"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-mock lp-mock-widget">
        <div className="lp-m-widget-title">Топ ефективності</div>
        <div className="lp-m-bars">
          {EFFICIENCY.map((s) => (
            <div className="lp-m-bar-row" key={s.name}>
              <span className="lp-m-bar-label" aria-hidden="true">
                {s.avatar}
              </span>
              <span className="lp-m-bar-track">
                <span className="lp-m-bar-fill" style={{ width: `${s.value}%` }} />
              </span>
              <span className="lp-m-bar-value">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Сторінка учня                                                       */
/* ------------------------------------------------------------------ */

const STUDENT_PRIZES = [
  { name: "Кіндер", pct: 100, caption: "ОТРИМАНО", state: "done" },
  { name: "Стікери", pct: 87, caption: "15 ЗІРОК", state: "progress" },
  { name: "3Д друк", pct: 33, caption: "40 ЗІРОК", state: "progress" },
];

const STUDENT_HISTORY = [
  { date: "26 ВЕР 2026", title: "⭐ Урок", amount: 1 },
  { date: "24 ВЕР 2026", title: "🎁 Бонус: допомогла з проєктом", amount: 2 },
  { date: "19 ВЕР 2026", title: "⚡ Штраф: запізнення", amount: -1 },
];

export function StudentMock() {
  return (
    <div className="lp-m-student-page">
      <div className="lp-mock lp-m-hero-card">
        <div className="lp-m-big-avatar" aria-hidden="true">
          🦊
        </div>
        <div className="lp-m-big-name">Оксі</div>
        <div className="lp-m-big-row">
          <span className="lp-m-big-stars">
            13 <LandingStar size="2rem" color="currentColor" />
          </span>
          <span className="lp-m-big-rank">#1</span>
        </div>
      </div>

      <div className="lp-mock lp-m-privacy">
        <Lock weight="bold" aria-hidden="true" />
        <span>Цю сторінку бачиш лише ти та вчитель. Однокласники доступу до неї не мають.</span>
      </div>

      <div className="lp-mock lp-m-card">
        <div className="lp-m-card-title">Прогрес нагород</div>
        {STUDENT_PRIZES.map((p) => (
          <div className="lp-m-prize" key={p.name}>
            <div className="lp-m-prize-head">
              <span>{p.name}</span>
              <span className={p.state === "done" ? "lp-m-pct-done" : undefined}>{p.pct}%</span>
            </div>
            <span className="lp-m-heavy-track">
              <span
                className={p.state === "done" ? "lp-m-heavy-fill lp-m-heavy-done" : "lp-m-heavy-fill"}
                style={{ width: `${p.pct}%` }}
              />
            </span>
            <div className="lp-m-prize-caption">{p.caption}</div>
          </div>
        ))}
      </div>

      <div className="lp-mock lp-m-card">
        <div className="lp-m-card-title">Історія зірок</div>
        {STUDENT_HISTORY.map((h) => (
          <div className={h.amount < 0 ? "lp-m-hist lp-m-hist-neg" : "lp-m-hist"} key={h.date}>
            <span className="lp-m-hist-main">
              <span className="lp-m-hist-date">{h.date}</span>
              <span className="lp-m-hist-title">{h.title}</span>
            </span>
            <span className={h.amount < 0 ? "lp-m-hist-amount lp-m-neg" : "lp-m-hist-amount"}>
              {h.amount > 0 ? `+${h.amount}` : h.amount} <LandingStar size="0.9rem" color="currentColor" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
