"use client";

import { useEffect } from "react";
import { App } from "antd";

/**
 * Спливне повідомлення "тут бачиш лише себе" (9.13, живий фідбек) — раніше
 * це був статичний підпис на картці "Моя статистика", але вчитель попросив
 * саме попап. showOnce=false (blocked-редірект) показує щоразу, бо це
 * пояснення КОНКРЕТНОЇ дії (чуже посилання не спрацювало); showOnce=true
 * (звичайний вхід) — раз на сесію браузера, щоб не набридало.
 *
 * message беремо через App.useApp() (9.13), не статичним імпортом — той
 * не завжди надійно консюмить контекст у antd v5+.
 *
 * Текст лівим краєм, в один рядок (9.16, живий фідбек) — дефолтний
 * antd-текст у message був по центру й переносився на два рядки, виглядало
 * не дуже. TOAST_STYLE примусово вирівнює вміст.
 */
const TOAST_STYLE: React.CSSProperties = { textAlign: "left", whiteSpace: "nowrap" };

export default function PersonalDashboardIntroToast({ blocked }: { blocked: boolean }) {
  const { message } = App.useApp();

  useEffect(() => {
    // Один короткий текст в обох випадках (9.16, живий фідбек) — щоб
    // повідомлення завжди лишалось в один рядок.
    const content = <span style={TOAST_STYLE}>Ви можете переглядати лише власний профіль.</span>;
    if (blocked) {
      message.info({ content, duration: 5 });
      return;
    }
    const key = "sld_seen_own_profile_notice";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    message.info({ content, duration: 4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  return null;
}
