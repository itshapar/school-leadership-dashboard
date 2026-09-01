"use client";

import { useState } from "react";
import { CaretDown, PlayCircle } from "@phosphor-icons/react";
import { TUTORIAL_EMBED_URL } from "@/lib/tutorial";

/**
 * Картка з відеотуторіалом згори кабінету: вбудований Loom, який можна
 * згорнути кареткою праворуч.
 *
 * Згорнутий стан НЕ запам'ятовується (живий фідбек): раніше він лежав у
 * localStorage, і вчитель, який один раз згорнув картку, більше ніколи її
 * не бачив. Тепер кожне відкриття кабінету починається з розгорнутої
 * інструкції, а згортання діє тільки до наступного заходу.
 *
 * iframe монтується лише коли картка відкрита, тож у згорнутому стані
 * плеєр Loom не вантажиться, а при повторному відкритті вантажиться
 * наново.
 */

export default function TutorialCard() {
  const [open, setOpen] = useState(true);

  return (
    <div className="star-card" style={{ padding: "16px", marginBottom: "24px" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
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
