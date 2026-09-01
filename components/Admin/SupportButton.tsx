"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCircleDots, PaperPlaneTilt, Bug, X } from "@phosphor-icons/react";
import { SUPPORT_FORM_URL, SUPPORT_TELEGRAM_URL } from "@/lib/support";

/**
 * Кнопка підтримки в кутку кабінету.
 *
 * Кругла кнопка, а не пункт меню: проблема трапляється посеред роботи, і
 * шукати, куди про неї написати, людина не буде. Клік відкриває панель із
 * двома каналами, Telegram для «горить зараз» і форма для «знайшов баг».
 *
 * Обидва посилання відкриваються в новій вкладці: якщо вчитель посеред
 * заповнення журналу, забирати в нього сторінку не можна.
 *
 * Якщо посилань ще немає (порожні константи в lib/support.ts), компонент
 * не рендериться взагалі.
 */
export default function SupportButton({ bottomOffset = 24 }: { bottomOffset?: number }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Клік повз панель закриває її: інакше вона накриває куток журналу і
  // виглядає як зависла.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!SUPPORT_TELEGRAM_URL && !SUPPORT_FORM_URL) return null;

  const linkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 10,
    border: "3px solid #000",
    background: "#ffffff",
    color: "#000000",
    fontWeight: 800,
    fontSize: "0.85rem",
    textDecoration: "none",
    boxShadow: "3px 3px 0px #000",
  };

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        right: 20,
        bottom: bottomOffset,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {open && (
        <div
          className="star-card"
          style={{ padding: 16, width: 260, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "0.95rem" }}>
            Підтримка
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Щось не працює або чогось бракує? Напишіть, я читаю все.
          </div>

          {SUPPORT_TELEGRAM_URL && (
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              <PaperPlaneTilt weight="bold" style={{ fontSize: "1.2rem", flexShrink: 0 }} />
              Написати в Telegram
            </a>
          )}

          {SUPPORT_FORM_URL && (
            <a href={SUPPORT_FORM_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              <Bug weight="bold" style={{ fontSize: "1.2rem", flexShrink: 0 }} />
              Повідомити про проблему
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Закрити підтримку" : "Підтримка"}
        aria-expanded={open}
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: "3px solid #000",
          background: open ? "#ffffff" : "var(--color-star)",
          boxShadow: "3px 3px 0px #000",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {open ? (
          <X weight="bold" style={{ fontSize: "1.5rem" }} />
        ) : (
          <ChatCircleDots weight="fill" style={{ fontSize: "1.6rem" }} />
        )}
      </button>
    </div>
  );
}
