"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spin, Tabs, message } from "antd";
import Link from "next/link";
import {
  ArrowLeftOutlined,
  GiftOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  loadClassGroups,
  loadClassPrizes,
  loadIndividualPrizes,
  type ClassGroup,
  type ClassPrize,
  type IndividualPrize,
} from "@/lib/admin/classConfig";
import PrizesPanel from "@/components/Admin/ClassSettings/PrizesPanel";
import GroupsPanel from "@/components/Admin/ClassSettings/GroupsPanel";
import { ResetClassPinsButton } from "@/components/Admin/PinManager";
import { formatClassCode } from "@/lib/classCodes";

/**
 * Налаштування класу — одне місце замість модалки «Нагороди».
 *
 * Система балів (типи нарахувань) тут більше НЕ редагується — Етап 9 зробив
 * її фіксованим стандартом для всіх класів (накочується автоматично при
 * створенні, див. OnboardingWizard.createClass). Замість вкладки "Типи
 * нарахувань" тут тепер код класу і PIN-и — раніше вони жили в кроці
 * майстра "Коди", який прибрали: показувати їх варто вже ПІСЛЯ створення
 * класу, а не як обов'язковий крок.
 */

export interface StudentRow {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
  group_id: string | null;
}

interface Props {
  classId: string;
  classCode: string;
  className: string;
  initialStudents: StudentRow[];
}

export default function ClassSettingsClient({
  classId,
  classCode,
  className,
  initialStudents,
}: Props) {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [individualPrizes, setIndividualPrizes] = useState<IndividualPrize[]>([]);
  const [classPrizes, setClassPrizes] = useState<ClassPrize[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);

  const refresh = useCallback(async () => {
    try {
      const [indiv, cls, grps, studentsRes] = await Promise.all([
        loadIndividualPrizes(supabase, classId),
        loadClassPrizes(supabase, classId),
        loadClassGroups(supabase, classId),
        supabase
          .from("students")
          .select("id, full_name, nickname, avatar_emoji, group_id")
          .eq("class_id", classId)
          .is("deleted_at", null)
          .order("full_name"),
      ]);
      setIndividualPrizes(indiv);
      setClassPrizes(cls);
      setGroups(grps);
      setStudents((studentsRes.data ?? []) as StudentRow[]);
    } catch {
      message.error("Не вдалося завантажити налаштування");
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
        <Link href={`/admin/${classCode}`}>
          <Button
            icon={<ArrowLeftOutlined />}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              height: 38,
              width: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Link>
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 900,
              fontSize: "1.6rem",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            Налаштування класу
          </h1>
          <div style={{ color: "#868e96", fontWeight: 700, fontSize: "0.9rem" }}>
            {className}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#f8f9fa",
          border: "2px solid #dee2e6",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#868e96", textTransform: "uppercase" }}>
            Код класу
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "1.5rem",
              fontWeight: 900,
              letterSpacing: "0.1em",
              marginTop: 2,
            }}
          >
            {formatClassCode(classCode)}
          </div>
        </div>
        {!loading && students.length > 0 && (
          <ResetClassPinsButton
            classId={classId}
            publicCode={classCode}
            className={className}
            students={students}
          />
        )}
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
                label: (
                  <span style={{ fontWeight: 800 }}>
                    <GiftOutlined /> Індивідуальні призи
                  </span>
                ),
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="individual"
                    individualPrizes={individualPrizes}
                    onChanged={refresh}
                  />
                ),
              },
              {
                key: "class",
                label: (
                  <span style={{ fontWeight: 800 }}>
                    <TrophyOutlined /> Призи класу
                  </span>
                ),
                children: (
                  <PrizesPanel
                    classId={classId}
                    kind="class"
                    classPrizes={classPrizes}
                    onChanged={refresh}
                  />
                ),
              },
              {
                key: "groups",
                label: (
                  <span style={{ fontWeight: 800 }}>
                    <TeamOutlined /> Групи
                  </span>
                ),
                children: (
                  <GroupsPanel
                    classId={classId}
                    groups={groups}
                    students={students}
                    onChanged={refresh}
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
