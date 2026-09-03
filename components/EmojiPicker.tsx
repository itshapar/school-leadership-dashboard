"use client";

/**
 * Пікер емодзі для аватарок учнів, нагород і будь-яких інших полів, де
 * раніше стояв звичайний <Input> і треба було десь узяти емодзі самому
 * (Win+. чи Ctrl+Cmd+Space знає далеко не кожен вчитель).
 *
 * Працює як контрольований інпут: value/onChange, тож підставляється
 * прямо в <Form.Item name="..."> замість <Input> без інших змін.
 *
 * Каталог і український пошук — у lib/emojiCatalog.ts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Popover } from "antd";
import { EMOJI_CATEGORIES, searchEmoji } from "@/lib/emojiCatalog";

const RECENT_KEY = "starboard:recent-emoji";
const RECENT_LIMIT = 9; // рівно один рядок сітки, щоб попап лишався низьким

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function pushRecent(emoji: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* приватний режим чи заповнене сховище: нещодавні просто не збережуться */
  }
}

export default function EmojiPicker({
  value,
  onChange,
  size = 56,
  disabled,
}: {
  value?: string;
  onChange?: (emoji: string) => void;
  /** Розмір кнопки-тригера в пікселях. */
  size?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0].id);
  const [recent, setRecent] = useState<string[]>([]);
  const searchRef = useRef<import("antd").InputRef>(null);

  useEffect(() => {
    if (open) {
      setRecent(readRecent());
      setQuery("");
      // Фокус у пошук одразу: клавіатурний шлях "відкрив, набрав кіт, Enter".
      window.setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => searchEmoji(query), [query]);
  const searching = query.trim().length > 0;
  const category = EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0];
  const shown = searching ? results.map((i) => i.char) : category.items.map((i) => i.char);

  const pick = (emoji: string) => {
    onChange?.(emoji);
    pushRecent(emoji);
    setOpen(false);
  };

  const cell = (emoji: string, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(emoji)}
      title={emoji}
      aria-label={`Емодзі ${emoji}`}
      aria-pressed={value === emoji}
      className="emoji-cell"
      style={{
        border: value === emoji ? "2px solid #2C2C2C" : "2px solid transparent",
      }}
    >
      {emoji}
    </button>
  );

  const content = (
    // На вузькому екрані попап не має впиратися в краї: інакше antd
    // притискає його до самого борту вікна.
    <div style={{ width: "min(316px, calc(100vw - 88px))" }}>
      <Input
        ref={searchRef}
        allowClear
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук: кіт, зірка, торт…"
        style={{ marginBottom: 10 }}
      />

      {!searching && (
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: 8,
            borderBottom: "2px solid #f1f3f5",
            paddingBottom: 6,
            overflowX: "auto",
          }}
        >
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              title={c.label}
              aria-label={c.label}
              aria-pressed={c.id === categoryId}
              className="emoji-tab"
              style={{
                background: c.id === categoryId ? "#FFF0F6" : "transparent",
                border: c.id === categoryId ? "2px solid #2C2C2C" : "2px solid transparent",
              }}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      {!searching && recent.length > 0 && (
        <>
          <div className="emoji-section-title">Нещодавні</div>
          <div className="emoji-grid" style={{ marginBottom: 8 }}>
            {recent.map((e, i) => cell(e, `recent-${i}-${e}`))}
          </div>
        </>
      )}

      {/* Висота свідомо обмежена: попап відкривається всередині модалки, і
          якщо він вищий за вільне місце, antd перевертає його вгору і верх
          (пошук, вкладки) виїжджає за екран. */}
      <div
        className="emoji-grid"
        style={{ maxHeight: !searching && recent.length > 0 ? 106 : 140, overflowY: "auto" }}
      >
        {shown.map((e, i) => cell(e, `${searching ? "q" : category.id}-${i}-${e}`))}
      </div>

      {searching && shown.length === 0 && (
        <div style={{ padding: "18px 4px", textAlign: "center", color: "#868e96", fontSize: "0.85rem" }}>
          Нічого не знайшли. Спробуй інше слово або встав своє емодзі в поле нижче.
        </div>
      )}

      <div style={{ marginTop: 8, borderTop: "2px solid #f1f3f5", paddingTop: 8 }}>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          maxLength={8}
          size="small"
          placeholder="Або встав своє емодзі"
          style={{ fontSize: "1rem" }}
        />
      </div>

      <style jsx global>{`
        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 2px;
        }
        .emoji-cell {
          font-size: 1.25rem;
          line-height: 1;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          padding: 0;
        }
        .emoji-cell:hover {
          background: #FFF0F6;
        }
        .emoji-tab {
          font-size: 1rem;
          line-height: 1;
          height: 30px;
          min-width: 30px;
          border-radius: 8px;
          cursor: pointer;
          padding: 0;
          flex: 0 0 auto;
        }
        .emoji-tab:hover {
          background: #FFF0F6;
        }
        .emoji-section-title {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #868e96;
          margin: 0 0 4px;
        }
      `}</style>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => !disabled && setOpen(o)}
      trigger="click"
      placement="bottomLeft"
      content={content}
      styles={{ content: { padding: 12 } }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Обрати емодзі"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.5,
          lineHeight: 1,
          borderRadius: 10,
          border: "2px solid #2C2C2C",
          background: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          padding: 0,
        }}
      >
        {value || "🙂"}
      </button>
    </Popover>
  );
}
