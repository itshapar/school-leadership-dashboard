"use client";

import { useEffect } from "react";
import { message } from "antd";

/**
 * Спливне повідомлення "тут бачиш лише себе" (9.13, живий фідбек) — раніше
 * це був статичний підпис на картці "Моя статистика", але вчитель попросив
 * саме попап. showOnce=false (blocked-редірект) показує щоразу, бо це
 * пояснення КОНКРЕТНОЇ дії (чуже посилання не спрацювало); showOnce=true
 * (звичайний вхід) — раз на сесію браузера, щоб не набридало.
 */
export default function PersonalDashboardIntroToast({ blocked }: { blocked: boolean }) {
  useEffect(() => {
    if (blocked) {
      message.info({
        content: "Це посилання вело на чужу сторінку. Тут можна переглянути лише власний профіль.",
        duration: 5,
      });
      return;
    }
    const key = "sld_seen_own_profile_notice";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    message.info({
      content: "Тут видно лише твій особистий профіль, однокласники його не бачать.",
      duration: 4,
    });
  }, [blocked]);

  return null;
}
