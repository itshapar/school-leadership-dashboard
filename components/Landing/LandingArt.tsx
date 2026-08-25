import { Play, Star } from "@phosphor-icons/react/dist/ssr";

/**
 * Дві анімовані ілюстрації лендінгу: логотип і петля «вчитель, зірка,
 * учень, нагорода».
 *
 * Усі анімації описані класами .lp-a-* в app/landing.css, тож самі
 * вимикаються під prefers-reduced-motion. Компоненти серверні: на лендінгу
 * немає клієнтського JS.
 *
 * Геометрія збігається з кроками кейфреймів: центри трьох панелей стоять
 * через 196px і 200px, бо такі зсуви прописані в .lp-a-fly. Міняючи одне,
 * треба міняти й друге.
 */

const BLACK = "#000000";
const GREEN = "#20C31A";
const STAR = "#F08C00";

/** П'ятикутна зірка радіусом 9, центр у 0,0. */
const STAR_D =
  "M0 -9 L2.23 -3.07 L8.56 -2.78 L3.61 1.17 L5.29 7.28 L0 3.8 " +
  "L-5.29 7.28 L-3.61 1.17 L-8.56 -2.78 L-2.23 -3.07 Z";

/**
 * Та сама зірка, що й у застосунку (components/StarIcon.tsx), але серверна.
 * StarIcon позначений "use client" заради Phosphor з CSR-входу; тягнути
 * його на лендінг означало б тягнути туди й клієнтський рантайм, тому тут
 * той самий Phosphor Star, лише з SSR-входу і з тим самим зсувом базової
 * лінії.
 */
export function LandingStar({
  size = "1em",
  color = "var(--color-star)",
}: {
  size?: string | number;
  color?: string;
}) {
  return (
    <Star
      weight="fill"
      size={size}
      color={color}
      style={{ verticalAlign: "-0.125em", flexShrink: 0 }}
    />
  );
}

export function LogoStar({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="9" fill={STAR} stroke={BLACK} strokeWidth="3" />
      <g transform="translate(16 16.5) scale(1.05)">
        <path d={STAR_D} fill="#FFFFFF" stroke={BLACK} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Петля продукту: вчитель ставить зірку в журналі, зірка долітає до
 * сторінки учня, зірки складаються в нагороду. Крутиться нескінченно, бо
 * цикл повторюється щоуроку.
 */
export function RewardFlow() {
  return (
    <svg
      viewBox="0 0 580 300"
      role="img"
      aria-labelledby="lp-flow-title"
      style={{ fontFamily: "inherit" }}
    >
      <title id="lp-flow-title">
        Вчитель ставить зірку в журналі, учень бачить її на своїй сторінці,
        зірки складаються в нагороду
      </title>

      {/* ── Вчитель ── */}
      <g>
        <rect x="16" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="16" y="64" width="156" height="176" rx="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <text x="94" y="52" textAnchor="middle" fontSize="13" fontWeight={900} fill={BLACK}>
          ВЧИТЕЛЬ
        </text>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${94 + i * 48})`}>
            <text x="42" y="6" textAnchor="middle" fontSize="17">
              {["🦊", "🐼", "🦉"][i]}
            </text>
            <rect x="60" y="-5" width="54" height="10" rx="5" fill="#DEE2E6" />
            <rect x="126" y="-15" width="30" height="30" rx="8" fill="#FFFFFF" stroke="#DEE2E6" strokeWidth="2" />
            <text
              className={`lp-a-score lp-d${i + 1}`}
              x="141"
              y="8"
              textAnchor="middle"
              fontSize="19"
              fontWeight={900}
              fill={BLACK}
            >
              {[1, 2, 1][i]}
            </text>
          </g>
        ))}
      </g>

      {/* ── Учень ── */}
      <g>
        <rect x="212" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="212" y="64" width="156" height="176" rx="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <text x="290" y="52" textAnchor="middle" fontSize="13" fontWeight={900} fill={BLACK}>
          УЧЕНЬ
        </text>
        <text x="290" y="122" textAnchor="middle" fontSize="42" className="lp-a-float">
          🦊
        </text>
        <text x="290" y="146" textAnchor="middle" fontSize="13" fontWeight={900} fill={BLACK}>
          ОКСІ
        </text>
        <g transform="translate(268 178)">
          <path d={STAR_D} fill={STAR} stroke="none" />
        </g>
        <text x="286" y="187" fontSize="26" fontWeight={900} fill={STAR} className="lp-a-num-out">
          12
        </text>
        <text x="286" y="187" fontSize="26" fontWeight={900} fill={STAR} className="lp-a-num-in">
          13
        </text>
        <rect x="242" y="204" width="96" height="14" rx="7" fill="#FFFFFF" stroke={BLACK} strokeWidth="2.5" />
        <rect className="lp-a-fill" x="245" y="207" width="12" height="8" rx="4" fill={GREEN} />
      </g>

      {/* ── Нагорода ── */}
      <g>
        <rect x="408" y="64" width="156" height="176" rx="16" fill={BLACK} transform="translate(5 5)" />
        <rect x="408" y="64" width="156" height="176" rx="16" fill="#FFFFFF" stroke={BLACK} strokeWidth="3" />
        <text x="486" y="52" textAnchor="middle" fontSize="13" fontWeight={900} fill={BLACK}>
          НАГОРОДА
        </text>
        <rect x="436" y="96" width="100" height="112" rx="14" fill="#F8F9FA" stroke="#DEE2E6" strokeWidth="3" />
        <rect
          className="lp-a-unlock"
          x="436"
          y="96"
          width="100"
          height="112"
          rx="14"
          fill="#EBFBEE"
          stroke={GREEN}
          strokeWidth="3"
        />
        <g className="lp-a-pop">
          <text x="486" y="152" textAnchor="middle" fontSize="34">
            🎁
          </text>
        </g>
        {/* Підпис з'являється разом із зеленою карткою: доки нагорода
            закрита, писати «отримано» нема за що. */}
        <text
          className="lp-a-unlock"
          x="486"
          y="182"
          textAnchor="middle"
          fontSize="12"
          fontWeight={900}
          fill={BLACK}
        >
          ОТРИМАНО
        </text>
      </g>

      {/* ── Стрілки ── */}
      {[180, 376].map((x) => (
        <g key={x} stroke={BLACK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={`M${x} 152 L${x + 24} 152`} />
          <path d={`M${x + 17} 146 L${x + 24} 152 L${x + 17} 158`} strokeLinejoin="round" />
        </g>
      ))}

      {/* ── Зірка, що летить крізь усю петлю ── */}
      {/* Базова точка, клітинка першого уроку в журналі: звідти зірка й
          вилітає. Зсуви в .lp-a-fly відлічуються саме від неї. */}
      <g className="lp-a-fly" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <g transform="translate(141 94) scale(1.35)">
          <path d={STAR_D} fill={STAR} stroke={BLACK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <span className="lp-play-glyph" aria-hidden="true">
      <Play weight="fill" size={26} />
    </span>
  );
}
