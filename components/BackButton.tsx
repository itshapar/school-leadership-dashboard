import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

/**
 * Кнопка «назад» — одна на весь інтерфейс (живий фідбек): чорна, біла
 * стрілка, чорна обводка, ефект натискання. Раніше кожен екран малював її
 * інлайн-стилями по-своєму: 38 чи 44 пікселі, з обводкою чи без, з тінню
 * чи з розмитим `rgba`-шедоу.
 *
 * Імпорт іконки з `/dist/ssr`: компонент має працювати і в серверних
 * сторінках (`app/**\/page.tsx` без "use client"), а звичайний варіант
 * Phosphor тягне за собою клієнтський контекст. Тому й `weight="bold"`
 * стоїть явно, а не приходить з IconContext.
 *
 * Вигляд задає клас `.back-btn` у `app/globals.css`.
 */
export default function BackButton({
  href,
  label = "Назад",
}: {
  href: string;
  /** Текст для скрінрідера: сама кнопка лише з іконкою. */
  label?: string;
}) {
  return (
    <Link href={href} className="back-btn" aria-label={label} title={label}>
      <ArrowLeft weight="bold" />
    </Link>
  );
}
