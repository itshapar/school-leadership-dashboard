"use client";

/**
 * Палітра кольорів для типу нарахування.
 *
 * Свідомо фіксований набір, а не вільний ColorPicker: у БД стоїть CHECK
 * `color ~ '^#[0-9A-Fa-f]{6}$'` (міграція 015), а довільний пікер повертає
 * rgba/hsl і формати з альфа-каналом — половина з них не пройшла б у базу.
 * Плюс фіксована палітра тримає журнал читабельним.
 */

export const ENTRY_COLORS = [
  "#F59F00", // бурштин (зірки)
  "#2F9E44", // зелений
  "#E03131", // червоний
  "#1971C2", // синій
  "#7048E8", // фіолетовий
  "#0CA678", // бірюзовий
  "#F76707", // помаранчевий
  "#495057", // графіт
] as const;

export default function ColorSwatches({
  value,
  onChange,
}: {
  value?: string | null;
  onChange?: (color: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      {ENTRY_COLORS.map((color) => {
        const selected = value?.toUpperCase() === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={`Колір ${color}`}
            aria-pressed={selected}
            onClick={() => onChange?.(selected ? null : color)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: color,
              cursor: "pointer",
              border: selected ? "3px solid #000" : "2px solid #dee2e6",
              boxShadow: selected ? "0 0 0 2px #fff inset" : "none",
              padding: 0,
            }}
          />
        );
      })}
      <button
        type="button"
        onClick={() => onChange?.(null)}
        style={{
          height: 30,
          padding: "0 10px",
          borderRadius: 8,
          border: value ? "2px solid #dee2e6" : "3px solid #000",
          background: "#fff",
          fontWeight: 700,
          fontSize: "0.78rem",
          cursor: "pointer",
        }}
      >
        Без кольору
      </button>
    </div>
  );
}
