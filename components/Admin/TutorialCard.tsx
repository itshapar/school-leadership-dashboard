"use client";

import { useEffect, useState } from "react";
import { CaretDown, PlayCircle } from "@phosphor-icons/react";

/**
 * Картка з відеотуторіалом згори кабінету: вбудований Loom, який можна
 * згорнути кареткою праворуч.
 *
 * Стан згортання живе в localStorage, а не в сесії: вчитель, який уже
 * подивився інструкцію, не має згортати її щоразу при вході. Початковий
 * стан, розгорнуто; localStorage читається в useEffect, бо на сервері
 * його немає і будь-яке читання під час рендеру дало б розбіжність
 * гідратації.
 *
 * iframe монтується лише коли картка відкрита, тож у згорнутому стані
 * плеєр Loom взагалі не вантажиться.
 */

const STORAGE_KEY = "sld_tutorial_collapsed";
const LOOM_EMBED = "https://www.loom.com/embed/b1b56faf44544e1f81d4629a6cb05e8e";

export default function TutorialCard() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setOpen(false);
    } catch {
      // приватний режим або заблоковане сховище: лишаємо картку відкритою
    }
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "0" : "1");
      } catch {
        // те саме: не змогли запам'ятати, але згортання все одно працює
      }
      return next;
    });
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
            src={LOOM_EMBED}
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
