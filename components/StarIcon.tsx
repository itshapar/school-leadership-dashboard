"use client";

import { Star } from "@phosphor-icons/react";
import type { CSSProperties } from "react";

/**
 * Єдина зірка на весь інтерфейс (живий фідбек): кількість зірок показуємо
 * ІКОНКОЮ, а не емодзі ⭐. Емодзі малюється системним шрифтом, тож виглядає
 * по-різному на кожній платформі, не тримає наш колір і не масштабується
 * разом з іконками решти інтерфейсу. Phosphor weight="fill" — той самий
 * набір, що й усі інші іконки після 9.25.
 *
 * size передається пропсом (а не через fontSize у стилі): Phosphor кладе
 * його прямо у width/height, тож "1em" — це рівно розмір тексту поруч, без
 * множення на дефолтний 1.15em з IconContext.
 *
 * verticalAlign: svg — інлайновий елемент і сидить на базовій лінії, тобто
 * помітно нижче за цифру поруч. Зсув на -0.125em ставить зірку по
 * оптичному центру рядка (у flex-контейнерах він нічого не псує, там
 * вирівнювання все одно вирішує align-items).
 */
export default function StarIcon({
  size = "1em",
  color = "var(--color-star)",
  style,
}: {
  /** Розмір у будь-яких CSS-одиницях; за замовчуванням дорівнює тексту поруч. */
  size?: string | number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <Star
      weight="fill"
      size={size}
      color={color}
      style={{ verticalAlign: "-0.125em", flexShrink: 0, ...style }}
    />
  );
}
