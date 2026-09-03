"use client";

import { useEffect, useState } from "react";
import { CaretDown, PlayCircle } from "@phosphor-icons/react";
import { TUTORIAL_EMBED_URL } from "@/lib/tutorial";

/**
 * Картка з відеотуторіалом згори кабінету: вбудований Loom, який можна
 * згорнути кареткою праворуч.
 *
 * Згорнутий стан ЗАПАМ'ЯТОВУЄТЬСЯ в localStorage (живий фідбек): вчитель,
 * який уже подивився відео, згортає картку один раз, а не при кожному
 * заході в кабінет. Раніше стан навмисне не зберігався, щоб інструкція не
 * зникала назавжди, але сам заголовок картки з кареткою нікуди не дівається
 * і в згорнутому стані, тож відео лишається за один клік.
 *
 * Початковий стан — `null`: на сервері localStorage немає, і читати його
 * під час рендеру означало б розбіжність гідратації. До того, як ефект
 * прочитає сховище, картка показується згорнутою. Ціна — той, хто заходить
 * уперше, бачить, як відео з'являється кадром пізніше; вигода — той, хто
 * картку згорнув, більше не бачить, як вона блимає розгорнутою на кожному
 * заході. Саме друге й дратувало.
 *
 * iframe монтується лише коли картка відкрита, тож у згорнутому стані
 * плеєр Loom не вантажиться, а при повторному відкритті вантажиться
 * наново.
 */

const COLLAPSED_KEY = "starboard:tutorial-collapsed";

export default function TutorialCard() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const open = collapsed === false;

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // приватний режим або заблоковане сховище: картка просто відкрита
      setCollapsed(false);
    }
  }, []);

  function toggle() {
    const next = !open;
    setCollapsed(!next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "0" : "1");
    } catch {
      /* не змогли запам'ятати, але згортання все одно працює до перезаходу */
    }
  }

  return (
    <div className="star-card" style={{ padding: "16px", marginBottom: "24px" }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
        }}
      >
        <PlayCircle weight="bold" style={{ fontSize: "1.8rem", color: "var(--color-star)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.5px" }}>
            Відеоінструкція
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
            Коротке відео про те, як користуватися StarBoard
          </div>
        </div>
        <CaretDown
          weight="bold"
          style={{
            fontSize: "1.4rem",
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            marginTop: "16px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "2px solid var(--color-border)",
          }}
        >
          <iframe
            src={TUTORIAL_EMBED_URL}
            title="Відеоінструкція StarBoard"
            allow="fullscreen; picture-in-picture"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
