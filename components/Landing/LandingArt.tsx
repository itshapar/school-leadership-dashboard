/**
 * Ілюстрації лендінгу: інлайнові SVG з CSS-анімаціями з app/landing.css.
 *
 * Чому інлайн, а не картинки: анімації описані класами (.lp-a-*), тобто
 * живуть в одному файлі стилів разом із рештою сторінки й самі
 * вимикаються під prefers-reduced-motion. Зовнішній .svg такого не вміє,
 * а <img> не пускає в себе наші CSS-змінні.
 *
 * Жодного стану й жодного ефекту, тож усе це серверні компоненти: на
 * лендінгу немає клієнтського JS взагалі.
 *
 * Геометрія навмисно збігається з кроками кейфреймів: колонки журналу
 * стоять через 74px, бо .lp-a-sweep рухає підсвітку саме на 74px, а
 * центри трьох панелей у петлі стоять через 196px і 200px, бо такі
 * зсуви прописані в .lp-a-fly. Міняючи одне, треба міняти й друге.
 */

/** П'ятикутна зірка радіусом 9, центр у 0,0. Той самий силует, що й у продукті. */
const STAR_D =
  "M0 -9 L2.23 -3.07 L8.56 -2.78 L3.61 1.17 L5.29 7.28 L0 3.8 " +
  "L-5.29 7.28 L-3.61 1.17 L-8.56 -2.78 L-2.23 -3.07 Z";

const BLACK = "#000000";
const GREEN = "#20C31A";
const STAR = "#F08C00";

/* ------------------------------------------------------------------ */
/* Логотип                                                             */
/* ------------------------------------------------------------------ */

export function LogoStar({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="9"
        fill={STAR}
        stroke={BLACK}
        strokeWidth="3"
      />
      <g transform="translate(16 16.5) scale(1.05)">
        <path d={STAR_D} fill="#FFFFFF" stroke={BLACK} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Петля: вчитель, учень, нагорода                                     */
/* ------------------------------------------------------------------ */

/**
 * Головна ілюстрація героя. Показує весь цикл продукту одним кадром:
 * вчитель відмічає зірку в журналі, зірка долітає до сторінки учня,
 * прогрес доходить до нагороди. Зірка летить нескінченно, бо цикл і в
 * житті повторюється щоуроку.
 */
export function HeroLoop() {
  return (
    <svg
      viewBox="0 0 580 300"
      role="img"
      aria-labelledby="lp-hero-title"
      style={{ fontFamily: "inherit" }}
    >
      <title id="lp-hero-title">
        Вчитель відмічає зірку в журналі, учень бачить її на своїй сторінці,
        зірки складаються в нагороду
      </title>

      {/* Панель 1: журнал вчителя */}
      <g>
        <rect x="16" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="16" y="64" width="156" height="176" rx="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <text x="90" y="52" textAnchor="middle" fontSize="14" fontWeight={900} fill={BLACK}>
          ВЧИТЕЛЬ
        </text>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${94 + i * 48})`}>
            <circle cx="46" cy="0" r="13" fill="#FFF4E6" stroke={BLACK} strokeWidth="3" />
            <text x="46" y="5" textAnchor="middle" fontSize="14">
              {["🦊", "🐼", "🦉"][i]}
            </text>
            <rect x="68" y="-6" width="52" height="11" rx="5" fill="#DEE2E6" />
            <rect x="130" y="-11" width="24" height="24" rx="7" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
            <path
              className={`lp-a-check lp-d${i + 1}`}
              d="M136 1 L141 6 L149 -4"
              fill="none"
              stroke={GREEN}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
      </g>

      {/* Панель 2: сторінка учня */}
      <g>
        <rect x="212" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="212" y="64" width="156" height="176" rx="16" fill="#FFF9DB" stroke={BLACK} strokeWidth="3" />
        <text x="290" y="52" textAnchor="middle" fontSize="14" fontWeight={900} fill={BLACK}>
          УЧЕНЬ
        </text>
        <rect x="252" y="86" width="76" height="132" rx="12" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <rect x="278" y="92" width="24" height="5" rx="2.5" fill={BLACK} />
        <text x="290" y="130" textAnchor="middle" fontSize="24" className="lp-a-float">
          🦊
        </text>
        <g transform="translate(272 156)">
          <path d={STAR_D} fill={STAR} stroke={BLACK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <text x="288" y="163" fontSize="20" fontWeight={900} fill={BLACK} className="lp-a-num-out">
          12
        </text>
        <text x="288" y="163" fontSize="20" fontWeight={900} fill={BLACK} className="lp-a-num-in">
          13
        </text>
        <rect x="262" y="178" width="56" height="12" rx="6" fill="#FFFFFF" stroke={BLACK} strokeWidth="2.5" />
        <rect className="lp-a-fill-sm" x="265" y="181" width="6" height="6" rx="3" fill={GREEN} />
        <text x="290" y="207" textAnchor="middle" fontSize="9" fontWeight={800} fill="#666666">
          13 / 15
        </text>
      </g>

      {/* Панель 3: нагорода */}
      <g>
        <rect x="412" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="412" y="64" width="156" height="176" rx="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <text x="490" y="52" textAnchor="middle" fontSize="14" fontWeight={900} fill={BLACK}>
          НАГОРОДА
        </text>
        <rect x="440" y="96" width="100" height="112" rx="14" fill="#F1F3F5" stroke={BLACK} strokeWidth="3" />
        <rect
          className="lp-a-unlock"
          x="440"
          y="96"
          width="100"
          height="112"
          rx="14"
          fill="#EBFBEE"
          stroke={GREEN}
          strokeWidth="3"
        />
        <text x="490" y="152" textAnchor="middle" fontSize="34" className="lp-a-pop">
          🎁
        </text>
        <text x="490" y="182" textAnchor="middle" fontSize="12" fontWeight={900} fill={BLACK}>
          ВІДКРИТО
        </text>
      </g>

      {/* Стрілки між панелями */}
      {[184, 380].map((x) => (
        <g key={x} stroke={BLACK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={`M${x} 152 L${x + 22} 152`} />
          <path d={`M${x + 15} 146 L${x + 22} 152 L${x + 15} 158`} strokeLinejoin="round" />
        </g>
      ))}

      {/* Зірка, що летить крізь усю петлю */}
      <g className="lp-a-fly" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <g transform="translate(90 152) scale(1.45)">
          <path d={STAR_D} fill={STAR} stroke={BLACK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Журнал вчителя                                                      */
/* ------------------------------------------------------------------ */

const JOURNAL_ROWS = [
  { avatar: "🦊", name: "Оксана Б.", checks: [1, 1, 1, 1], total: "13" },
  { avatar: "🐼", name: "Данило К.", checks: [1, 0, 1, 1], total: "11" },
  { avatar: "🦉", name: "Марія Л.", checks: [1, 1, 0, 1], total: "12" },
  { avatar: "🐨", name: "Артем С.", checks: [0, 1, 1, 1], total: "10" },
];

/**
 * Журнал: рядок, це учень, стовпчик, це урок. Помаранчева рамка
 * проходить по стовпчиках, показуючи, що вчитель веде саме уроками, а
 * не окремими нарахуваннями.
 */
export function TeacherJournal() {
  return (
    <svg
      viewBox="-6 -6 726 424"
      role="img"
      aria-labelledby="lp-journal-title"
      style={{ fontFamily: "inherit" }}
    >
      <title id="lp-journal-title">
        Журнал класу: рядки з учнями, стовпчики з уроками, галочки й
        підсумок зірок праворуч
      </title>

      <rect x="8" y="8" width="704" height="404" rx="20" fill={BLACK} />
      <rect x="0" y="0" width="704" height="404" rx="20" fill="#FFFFFF" stroke={BLACK} strokeWidth="4" />

      {/* Шапка */}
      <text x="28" y="46" fontSize="22" fontWeight={900} fill={BLACK}>
        7-А
      </text>
      <text x="82" y="46" fontSize="14" fontWeight={600} fill="#666666">
        І семестр 2026/2027
      </text>
      <g>
        <rect x="530" y="24" width="148" height="34" rx="10" fill={BLACK} />
        <text x="604" y="46" textAnchor="middle" fontSize="12" fontWeight={900} fill="#FFFFFF">
          + НОВИЙ УРОК
        </text>
      </g>
      <line x1="0" y1="72" x2="704" y2="72" stroke={BLACK} strokeWidth="3" />

      {/* Заголовки стовпчиків */}
      {[0, 1, 2, 3].map((c) => (
        <text
          key={c}
          x={343 + c * 74}
          y={104}
          textAnchor="middle"
          fontSize="11"
          fontWeight={800}
          fill="#666666"
        >
          УРОК {c + 1}
        </text>
      ))}
      <text x="644" y="104" textAnchor="middle" fontSize="11" fontWeight={800} fill={STAR}>
        ВСЬОГО
      </text>

      {/* Підсвітка активного стовпчика */}
      <g className="lp-a-sweep">
        <rect x="308" y="86" width="70" height="280" rx="12" fill="#FFF4E6" />
        <rect
          x="308"
          y="86"
          width="70"
          height="280"
          rx="12"
          fill="none"
          stroke={STAR}
          strokeWidth="4"
        />
      </g>

      {/* Рядки учнів */}
      {JOURNAL_ROWS.map((row, r) => {
        const y = 150 + r * 58;
        return (
          <g key={row.name}>
            <circle cx="52" cy={y} r="17" fill="#FFF9DB" stroke={BLACK} strokeWidth="3" />
            <text x="52" y={y + 6} textAnchor="middle" fontSize="18">
              {row.avatar}
            </text>
            <text x="82" y={y + 6} fontSize="15" fontWeight={600} fill={BLACK}>
              {row.name}
            </text>

            {row.checks.map((on, c) => {
              const cx = 343 + c * 74;
              return (
                <g key={c}>
                  <rect
                    x={cx - 13}
                    y={y - 13}
                    width="26"
                    height="26"
                    rx="8"
                    fill="#FFFFFF"
                    stroke={BLACK}
                    strokeWidth="3"
                  />
                  {on === 1 && (
                    <path
                      className={`lp-a-check lp-d${((r + c) % 5) + 1}`}
                      d={`M${cx - 6} ${y} L${cx - 1} ${y + 5} L${cx + 7} ${y - 6}`}
                      fill="none"
                      stroke={GREEN}
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              );
            })}

            <g transform={`translate(624 ${y})`}>
              <path d={STAR_D} fill={STAR} stroke={BLACK} strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            {r === 0 ? (
              <g className="lp-a-pop">
                <text x="640" y={y + 7} fontSize="19" fontWeight={900} fill={BLACK} className="lp-a-num-out">
                  12
                </text>
                <text x="640" y={y + 7} fontSize="19" fontWeight={900} fill={BLACK} className="lp-a-num-in">
                  13
                </text>
              </g>
            ) : (
              <text x="640" y={y + 7} fontSize="19" fontWeight={900} fill={BLACK}>
                {row.total}
              </text>
            )}
          </g>
        );
      })}

      {/* Нижній тулбар: три типи нарахувань, однакові в кожному класі */}
      <line x1="0" y1="352" x2="704" y2="352" stroke="#DEE2E6" strokeWidth="2.5" />
      {[
        { label: "⭐  УРОК", x: 28, bg: "#FFF9DB" },
        { label: "🎁  БОНУС", x: 148, bg: "#EBFBEE" },
        { label: "⚡  ШТРАФ", x: 276, bg: "#FFF0F6" },
      ].map((chip) => (
        <g key={chip.label}>
          <rect
            x={chip.x}
            y="366"
            width="112"
            height="30"
            rx="9"
            fill={chip.bg}
            stroke={BLACK}
            strokeWidth="3"
          />
          <text
            x={chip.x + 56}
            y="386"
            textAnchor="middle"
            fontSize="12"
            fontWeight={900}
            fill={BLACK}
          >
            {chip.label}
          </text>
        </g>
      ))}
      <text x="418" y="386" fontSize="12" fontWeight={600} fill="#666666">
        одному учню або всьому класу
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Сторінка учня                                                       */
/* ------------------------------------------------------------------ */

/**
 * Телефон учня: те, що дитина бачить після входу за PIN. Смуга прогресу
 * заповнюється, і в кінці циклу перша нагорода стає доступною.
 */
export function StudentPhone() {
  return (
    <svg
      viewBox="0 0 430 570"
      role="img"
      aria-labelledby="lp-phone-title"
      style={{ fontFamily: "inherit", maxHeight: 560, margin: "0 auto" }}
    >
      <title id="lp-phone-title">
        Сторінка учня в телефоні: аватар, кількість зірок, місце в
        рейтингу, прогрес до нагороди й нагадування про приватність
      </title>

      <rect x="18" y="18" width="402" height="544" rx="40" fill={BLACK} />
      <rect x="8" y="8" width="402" height="544" rx="40" fill="#FFF9F0" stroke={BLACK} strokeWidth="4" />
      <rect x="174" y="26" width="70" height="9" rx="4.5" fill={BLACK} />

      {/* Шапка профілю */}
      <circle cx="76" cy="106" r="32" fill="#FFF9DB" stroke={BLACK} strokeWidth="3.5" />
      <text x="76" y="118" textAnchor="middle" fontSize="32" className="lp-a-float">
        🦊
      </text>
      <text x="124" y="100" fontSize="21" fontWeight={900} fill={BLACK}>
        ОКСАНА
      </text>
      <text x="124" y="124" fontSize="14" fontWeight={600} fill="#666666">
        7-А, І семестр
      </text>

      {/* Зірки й місце */}
      <g>
        <rect x="38" y="158" width="166" height="86" rx="16" fill={BLACK} transform="translate(4 4)" />
        <rect x="38" y="158" width="166" height="86" rx="16" fill="#FFF4E6" stroke={BLACK} strokeWidth="3.5" />
        <text x="121" y="184" textAnchor="middle" fontSize="11" fontWeight={800} fill="#666666">
          МОЇ ЗІРКИ
        </text>
        <g transform="translate(92 214)">
          <g className="lp-a-pop">
            <path d={STAR_D} fill={STAR} stroke={BLACK} strokeWidth="2.5" strokeLinejoin="round" />
          </g>
        </g>
        <text x="112" y="223" fontSize="32" fontWeight={900} fill={BLACK} className="lp-a-num-out">
          12
        </text>
        <text x="112" y="223" fontSize="32" fontWeight={900} fill={BLACK} className="lp-a-num-in">
          13
        </text>
      </g>
      <g>
        <rect x="216" y="158" width="166" height="86" rx="16" fill={BLACK} transform="translate(4 4)" />
        <rect x="216" y="158" width="166" height="86" rx="16" fill="#FFF0F6" stroke={BLACK} strokeWidth="3.5" />
        <text x="299" y="184" textAnchor="middle" fontSize="11" fontWeight={800} fill="#666666">
          МІСЦЕ В КЛАСІ
        </text>
        <text x="299" y="226" textAnchor="middle" fontSize="34" fontWeight={900} fill={BLACK}>
          3
        </text>
      </g>

      {/* Прогрес до нагороди */}
      <text x="38" y="286" fontSize="12" fontWeight={900} fill={BLACK}>
        ПРОГРЕС НАГОРОД
      </text>
      <rect x="38" y="298" width="230" height="26" rx="13" fill="#FFFFFF" stroke={BLACK} strokeWidth="3.5" />
      <rect className="lp-a-fill" x="43" y="303" width="18" height="16" rx="8" fill={GREEN} />
      <text x="284" y="318" fontSize="15" fontWeight={900} fill={BLACK}>
        13 / 15
      </text>

      {/* Нагороди */}
      <g>
        <rect x="38" y="344" width="164" height="104" rx="14" fill="#F1F3F5" stroke={BLACK} strokeWidth="3.5" />
        <rect
          className="lp-a-unlock"
          x="38"
          y="344"
          width="164"
          height="104"
          rx="14"
          fill="#EBFBEE"
          stroke={GREEN}
          strokeWidth="3.5"
        />
        <text x="120" y="394" textAnchor="middle" fontSize="30">
          🍫
        </text>
        <text x="120" y="420" textAnchor="middle" fontSize="12" fontWeight={900} fill={BLACK}>
          КІНДЕР
        </text>
        <text x="120" y="437" textAnchor="middle" fontSize="11" fontWeight={800} fill="#666666">
          15 зірок
        </text>
      </g>
      <g opacity="0.55">
        <rect x="216" y="344" width="164" height="104" rx="14" fill="#F1F3F5" stroke={BLACK} strokeWidth="3.5" />
        <text x="298" y="394" textAnchor="middle" fontSize="30">
          🖨️
        </text>
        <text x="298" y="420" textAnchor="middle" fontSize="12" fontWeight={900} fill={BLACK}>
          3Д ДРУК
        </text>
        <text x="298" y="437" textAnchor="middle" fontSize="11" fontWeight={800} fill="#666666">
          40 зірок
        </text>
      </g>

      {/* Обіцянка приватності */}
      <rect x="38" y="470" width="342" height="58" rx="14" fill="#FFFFFF" stroke={BLACK} strokeWidth="3.5" />
      <text x="60" y="497" fontSize="16">
        🔒
      </text>
      <text x="84" y="494" fontSize="12" fontWeight={800} fill={BLACK}>
        Цю сторінку бачиш лише ти
      </text>
      <text x="84" y="512" fontSize="12" fontWeight={600} fill="#666666">
        та твій вчитель
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Іконки карток «що можна налаштувати»                                */
/* ------------------------------------------------------------------ */

function iconFrame(children: React.ReactNode, bg: string) {
  return (
    <svg viewBox="0 0 64 64" className="lp-card-icon" aria-hidden="true">
      <rect x="2" y="2" width="58" height="58" rx="16" fill={bg} stroke={BLACK} strokeWidth="3" />
      {children}
    </svg>
  );
}

export function IconPrize() {
  return iconFrame(
    <>
      <rect x="16" y="30" width="32" height="20" rx="4" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
      <line x1="32" y1="30" x2="32" y2="50" stroke={BLACK} strokeWidth="3" />
      <g className="lp-a-lid">
        <rect x="13" y="20" width="38" height="11" rx="4" fill={GREEN} stroke={BLACK} strokeWidth="3" />
      </g>
    </>,
    "#EBFBEE"
  );
}

export function IconGroups() {
  return iconFrame(
    <>
      <circle cx="22" cy="26" r="9" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" className="lp-a-pulse" />
      <circle cx="42" cy="26" r="9" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" className="lp-a-pulse lp-d2" />
      <circle cx="32" cy="44" r="9" fill={STAR} stroke={BLACK} strokeWidth="3" className="lp-a-pulse lp-d4" />
      <circle cx="22" cy="26" r="9" fill="none" stroke={BLACK} strokeWidth="3" />
      <circle cx="42" cy="26" r="9" fill="none" stroke={BLACK} strokeWidth="3" />
      <circle cx="32" cy="44" r="9" fill="none" stroke={BLACK} strokeWidth="3" />
    </>,
    "#FFF9DB"
  );
}

export function IconPrivacy() {
  return iconFrame(
    <>
      <path
        d="M12 32 C20 20, 44 20, 52 32 C44 44, 20 44, 12 32 Z"
        fill="#FFFFFF"
        stroke={BLACK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="6" fill={BLACK} />
      <line
        className="lp-a-toggle"
        x1="16"
        y1="46"
        x2="48"
        y2="18"
        stroke={BLACK}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </>,
    "#FFF0F6"
  );
}

export function IconPin() {
  const cells = [
    [18, 18],
    [28, 18],
    [38, 18],
    [18, 28],
    [38, 28],
    [18, 38],
    [28, 38],
    [38, 38],
  ];
  return iconFrame(
    <>
      {cells.map(([x, y], i) => (
        <rect
          key={`${x}-${y}`}
          className={`lp-a-blink lp-d${(i % 5) + 1}`}
          x={x}
          y={y}
          width="8"
          height="8"
          rx="2"
          fill={BLACK}
        />
      ))}
      <rect x="28" y="28" width="8" height="8" rx="2" fill={STAR} stroke={BLACK} strokeWidth="2" />
    </>,
    "#FFF4E6"
  );
}

export function IconAvatar() {
  return iconFrame(
    <>
      <circle cx="32" cy="32" r="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
      <text x="32" y="39" textAnchor="middle" fontSize="17" className="lp-a-float">
        🦊
      </text>
    </>,
    "#FFF9DB"
  );
}

export function IconSemester() {
  return iconFrame(
    <>
      <rect x="10" y="22" width="18" height="20" rx="5" fill="#F1F3F5" stroke={BLACK} strokeWidth="3" />
      <rect x="36" y="22" width="18" height="20" rx="5" fill={GREEN} stroke={BLACK} strokeWidth="3" />
      <g className="lp-a-slide">
        <path
          d="M28 32 L36 32 M32 28 L36 32 L32 36"
          fill="none"
          stroke={BLACK}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>,
    "#EBFBEE"
  );
}

/* ------------------------------------------------------------------ */
/* Дрібниці                                                            */
/* ------------------------------------------------------------------ */

export function CheckBadge() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11" fill={GREEN} stroke={BLACK} strokeWidth="3" />
      <path
        d="M7.5 13.5 L11.5 17.5 L18.5 9.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <svg width="66" height="66" viewBox="0 0 66 66" aria-hidden="true">
      <circle cx="33" cy="33" r="28" fill="#FFFFFF" stroke={BLACK} strokeWidth="4" />
      <circle cx="33" cy="33" r="28" fill={STAR} opacity="0.25" className="lp-a-pulse" />
      <path d="M27 21 L47 33 L27 45 Z" fill={BLACK} strokeLinejoin="round" strokeWidth="3" stroke={BLACK} />
    </svg>
  );
}
