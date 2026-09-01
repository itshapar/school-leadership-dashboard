"use client";

import { Tooltip } from "antd";
import { PaperPlaneTilt, Megaphone } from "@phosphor-icons/react";
import { SUPPORT_FORM_URL, SUPPORT_TELEGRAM_URL } from "@/lib/support";

/**
 * Дві плаваючі кнопки в кутку: підтримка і фідбек.
 *
 * Саме дві окремі іконки, а не одна кнопка з панеллю (живий фідбек): це
 * різні наміри, і зайвий клік між «у мене зламалось» і «є ідея» тільки
 * заважає. Тексту на кнопках немає, лише іконки, підпис показує тултип
 * при наведенні і читає екранний диктор.
 *
 * Літак, це швидкий шлях до живої людини, мегафон, це «хочу сказати» без
 * очікування відповіді. Помаранчевим позначена підтримка, бо коли щось
 * горить, шукати очима треба саме її.
 *
 * fixed, а не sticky: кнопки мають лишатись на місці при прокрутці
 * довгого журналу, а не їхати разом із ним.
 *
 * Порожнє посилання означає «каналу немає»: кнопка просто не рендериться.
 */

const BASE: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "3px solid #000",
  boxShadow: "3px 3px 0px #000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "#000000",
  flexShrink: 0,
};

export default function SupportButtons({ bottomOffset = 24 }: { bottomOffset?: number }) {
  if (!SUPPORT_TELEGRAM_URL && !SUPPORT_FORM_URL) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: bottomOffset,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {SUPPORT_FORM_URL && (
        <Tooltip title="Поділитися фідбеком" placement="left">
          <a
            href={SUPPORT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Поділитися фідбеком"
            style={{ ...BASE, background: "#ffffff" }}
          >
            <Megaphone weight="fill" style={{ fontSize: "1.5rem" }} />
          </a>
        </Tooltip>
      )}

      {SUPPORT_TELEGRAM_URL && (
        <Tooltip title="Служба підтримки" placement="left">
          <a
            href={SUPPORT_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Служба підтримки"
            style={{ ...BASE, background: "var(--color-star)" }}
          >
            <PaperPlaneTilt weight="fill" style={{ fontSize: "1.5rem" }} />
          </a>
        </Tooltip>
      )}
    </div>
  );
}
