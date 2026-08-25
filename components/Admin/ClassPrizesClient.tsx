"use client";

import { useCallback, useEffect, useState } from "react";
import { Spin, Tabs, message } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import PrizesPanel from "@/components/Admin/ClassSettings/PrizesPanel";
import {
  loadClassPrizes,
  loadIndividualPrizes,
  type ClassPrize,
  type IndividualPrize,
} from "@/lib/admin/classConfig";

/**
 * Нагороди класу — власна сторінка (живий фідбек).
 *
 * Раніше обидві вкладки жили всередині «Налаштувань класу», хоча вчитель
 * ходить у нагороди значно частіше, ніж у решту налаштувань, і шукав їх
 * саме з журналу. Тепер це окремий екран із власною кнопкою-подарунком у
 * тулбарі журналу, а налаштування лишаються тим, чим і мали бути: назва,
 * паралель, видимість, небезпечна зона.
 */
export default function ClassPrizesClient({
  classId,
  classCode,
  className,
  archived = false,
}: {
  classId: string;
  classCode: string;
  className: string;
  /** Клас в архіві: нагороди видно, але змінювати їх уже не можна. */
  archived?: boolean;
}) {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [individualPrizes, setIndividualPrizes] = useState<IndividualPrize[]>([]);
  const [classPrizes, setClassPrizes] = useState<ClassPrize[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [indiv, cls] = await Promise.all([
        loadIndividualPrizes(supabase, classId),
        loadClassPrizes(supabase, classId),
      ]);
      setIndividualPrizes(indiv);
      setClassPrizes(cls);
    } catch {
      message.error("Не вдалося завантажити нагороди");
    } finally {
      setLoading(false);
    }
  }, [classId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <BackButton href={`/admin/${classCode}`} label="Назад до журналу" />
        <h1
          style={{
            margin: 0,
            fontWeight: 900,
            fontSize: "1.6rem",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          Нагороди: {className}
        </h1>
      </div>

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          borderRadius: 16,
          boxShadow: "4px 4px 0px #000",
          padding: 20,
        }}
      >
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            defaultActiveKey="individual"
            items={[
              {
                key: "individual",
                label: <span style={{ fontWeight: 800 }}>Індивідуальні нагороди</span>,
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="individual"
                    individualPrizes={individualPrizes}
                    onChanged={refresh}
                    readOnly={archived}
                  />
                ),
              },
              {
                key: "class",
                label: <span style={{ fontWeight: 800 }}>Нагороди класу</span>,
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="class"
                    classPrizes={classPrizes}
                    onChanged={refresh}
                    readOnly={archived}
                  />
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
