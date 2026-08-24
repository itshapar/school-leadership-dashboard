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
 * Текст лівим краєм (9.16-9.17, живий фідбек) — перенесення на другий
 * рядок це ОК, whiteSpace:nowrap із попередньої версії якраз і обрізав
 * попап замість переносу. Прибрано.
 */
const TOAST_STYLE: React.CSSProperties = { textAlign: "left" };

export default function PersonalDashboardIntroToast({ blocked }: { blocked: boolean }) {
  const { message } = App.useApp();

  useEffect(() => {
    const content = <span style={TOAST_STYLE}>Ви можете переглядати лише власний профіль.</span>;
    if (blocked) {
      // key (9.17, живий фідбек): той самий ключ ОНОВЛЮЄ наявний попап
      // замість того, щоб штабелювати новий на кожен клік — інакше
      // повторні спроби завалювали б увесь екран сповіщеннями.
      message.info({ key: "own-profile-only", content, duration: 5 });
      return;
    }
    const key = "sld_seen_own_profile_notice";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    message.info({ key: "own-profile-only", content, duration: 4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  return null;
}
