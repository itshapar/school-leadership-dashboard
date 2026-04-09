"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, Select, Spin, message, Space, Checkbox } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import dayjs from "dayjs";
import { UserOutlined } from "@ant-design/icons";
import {
  loadManagementJournalData,
  type ManagementJournalData,
  type ManagementJournalStudent,
  type ManagementJournalLesson,
  type ManagementJournalPrize,
} from "@/lib/admin/managementJournalData";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";

type Student = ManagementJournalStudent;
type Lesson = ManagementJournalLesson;
type Prize = ManagementJournalPrize;

const STAR_OPTIONS = [
  { value: 0, label: "0" },
  { value: -1, label: "Н" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
];

function applyJournalState(
  data: ManagementJournalData,
  setters: {
    setStudents: (v: Student[]) => void;
    setLessons: (v: Lesson[]) => void;
    setPrizes: (v: Prize[]) => void;
    setEntries: (v: Record<string, Record<string, number>>) => void;
    setGivenPrizes: (v: Record<string, Record<string, boolean>>) => void;
    setTotalStars: (v: Record<string, number>) => void;
  }
) {
  setters.setStudents(data.students);
  setters.setLessons(data.lessons);
  setters.setPrizes(data.prizes);
  setters.setEntries(data.entries);
  setters.setGivenPrizes(data.givenPrizes);
  setters.setTotalStars(data.totalStars);
}

export default function ManagementTable({
  classId,
  initialData,
}: {
  classId: string;
  initialData?: ManagementJournalData;
}) {
  const [students, setStudents] = useState<Student[]>(initialData?.students ?? []);
  const [lessons, setLessons] = useState<Lesson[]>(initialData?.lessons ?? []);
  const [prizes, setPrizes] = useState<Prize[]>(initialData?.prizes ?? []);
  const [entries, setEntries] = useState<Record<string, Record<string, number>>>(
    initialData?.entries ?? {}
  );
  const [givenPrizes, setGivenPrizes] = useState<Record<string, Record<string, boolean>>>(
    initialData?.givenPrizes ?? {}
  );
  const [totalStars, setTotalStars] = useState<Record<string, number>>(initialData?.totalStars ?? {});

  const [loading, setLoading] = useState(!initialData);

  const supabase = getSupabaseClient();

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const data = await loadManagementJournalData(supabase, classId);
        applyJournalState(data, {
          setStudents,
          setLessons,
          setPrizes,
          setEntries,
          setGivenPrizes,
          setTotalStars,
        });
      } catch (err) {
        console.error(err);
        message.error("Помилка завантаження даних");
      } finally {
        setLoading(false);
      }
    },
    [classId, supabase]
  );

  useEffect(() => {
    // Якщо SSR вже передав initialData — не робимо повторний refetch.
    // Компонент ремаунтиться на `key={classId}` у сторінці адмін-класу.
    if (!initialData) {
      void loadData();
    }
  }, [initialData, loadData]);

  // Auto-save star amount (через API з серверною сесією — RLS у Supabase для запису)
  const handleStarChange = async (studentId: string, lessonId: string, amount: number) => {
    const oldAmount = entries[studentId]?.[lessonId] ?? 0;
    const diff = (amount > 0 ? amount : 0) - (oldAmount > 0 ? oldAmount : 0);

    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [lessonId]: amount },
    }));
    setTotalStars((prev) => ({
      ...prev,
      [studentId]: (prev[studentId] ?? 0) + diff,
    }));

    try {
      const res = await adminApiFetch(supabase, "/api/admin/star-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          lesson_id: lessonId,
          class_id: classId,
          amount,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
    } catch (err) {
      console.error(err);
      message.error(err instanceof Error ? err.message : "Помилка автозбереження");
      setEntries((prev) => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [lessonId]: oldAmount },
      }));
      setTotalStars((prev) => ({
        ...prev,
        [studentId]: (prev[studentId] ?? 0) - diff,
      }));
    }
  };

  const handlePrizeToggle = async (studentId: string, prizeId: string, checked: boolean) => {
    const prevVal = givenPrizes[studentId]?.[prizeId] ?? false;
    setGivenPrizes((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [prizeId]: checked },
    }));

    try {
      const res = await adminApiFetch(supabase, "/api/admin/prize-given", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, prize_id: prizeId, given: checked }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
    } catch (err) {
      console.error(err);
      message.error(err instanceof Error ? err.message : "Помилка збереження нагороди");
      setGivenPrizes((prev) => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [prizeId]: prevVal },
      }));
    }
  };

  const columns = [
    {
      title: <div style={{ fontWeight: 950, color: "#000" }}>#</div>,
      key: "index",
      width: 50,
      render: (_: any, __: any, index: number) => (
        <span style={{ color: "#adb5bd", fontWeight: 700 }}>{index + 1}</span>
      ),
      fixed: "left" as const,
      align: "center" as const,
    },
    {
      title: <div style={{ fontWeight: 950, color: "#000" }}>УЧЕНЬ</div>,
      key: "student",
      fixed: "left" as const,
      width: 220,
      render: (_: any, record: Student) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{record.avatar_emoji}</span>
          <div style={{ lineHeight: "1.2" }}>
            <div style={{ fontWeight: 850, fontSize: "1rem" }}>{record.full_name}</div>
            {record.nickname && (
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 700 }}>
                {record.nickname}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: <div style={{ textAlign: "center", fontWeight: 900 }}>BCЬOГO</div>,
      key: "total",
      width: 100,
      fixed: "left" as const,
      align: "center" as const,
      render: (_: any, record: Student) => (
        <div style={{
          fontSize: "1.2rem",
          fontWeight: 900,
          color: "#000000",
          background: "#f1f3f5",
          padding: "4px 8px",
          borderRadius: "8px",
          border: "2px solid #dee2e6"
        }}>
          {totalStars[record.id] ?? 0}
        </div>
      )
    },
    ...prizes.map((prize, idx) => {
      const names = ["Кіндер", "Стікер", "Пін", "3D-друк"];
      const titleText = names[idx] || prize.name;
      return {
        title: <div style={{ fontSize: "0.8rem", fontWeight: 900, whiteSpace: "nowrap" }} title={prize.name}>{titleText}</div>,
        key: `prize_${prize.id}`,
        width: 100,
        align: "center" as const,
        render: (_: any, record: Student) => {
          const isGiven = givenPrizes[record.id]?.[prize.id] ?? false;
          const isEligible = (totalStars[record.id] ?? 0) >= prize.stars_required;
          return (
            <Checkbox
              checked={isGiven}
              onChange={(e) => handlePrizeToggle(record.id, prize.id, e.target.checked)}
              style={{ transform: "scale(1.2)" }}
              className={!isGiven && isEligible ? "prize-eligible-checkbox" : ""}
            />
          );
        }
      };
    }),
    ...lessons.map((lesson, idx) => {
      const lessonDate = dayjs(lesson.date);
      const isToday = dayjs().isSame(lessonDate, "day");
      // Fallback: highlight the most recent past lesson if today is not a lesson day 
      // (only for the last recorded lesson or today)
      const isHighlighted = isToday || (idx === lessons.length - 1 && lessonDate.isBefore(dayjs()));
      
      return {
        title: (
          <div style={{
            fontWeight: 950,
            color: isHighlighted ? "#2b8a3e" : "#000",
            borderBottom: isHighlighted ? "2px solid #2b8a3e" : "none"
          }}>
            {lessonDate.format("DD.MM")}
          </div>
        ),
        key: lesson.id,
        width: 80,
        align: "center" as const,
        onCell: () => ({
          style: {
            background: isHighlighted ? "#ebfbee" : "inherit"
          }
        }),
        render: (_: any, record: Student) => {
          const score = entries[record.id]?.[lesson.id] ?? 0;
          return (
            <Select
              value={score}
              onChange={(val) => handleStarChange(record.id, lesson.id, val)}
              bordered={false}
              className="score-select"
              style={{
                width: "100%",
                fontWeight: 800,
                color: score > 0 ? "var(--color-star)" : (score === -1 ? "#fa5252" : "inherit")
              }}
              options={STAR_OPTIONS}
            />
          );
        }
      };
    }),
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "120px" }}>
        <Spin size="large" description="Завантаження журналу..." />
      </div>
    );
  }

  return (
    <div style={{ background: "#ffffff", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} className="full-width-table">
        <Table
          dataSource={students}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content", y: "calc(100vh - 80px)" }}
          size="middle"
          bordered
          sticky={{ offsetHeader: 73 }}
          className="management-grid"
          summary={() => {
            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row style={{ background: "#f1f3f5" }}>
                  <Table.Summary.Cell index={0}>
                    <div style={{ textAlign: "center", fontWeight: 950 }}>Σ</div>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <div style={{ fontWeight: 950, textTransform: "uppercase", fontSize: "0.8rem" }}>За урок:</div>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <div style={{ textAlign: "center", fontWeight: 950 }}>-</div>
                  </Table.Summary.Cell>
                  {/* Prize columns (empty sum) */}
                  {prizes.map((_, i) => (
                    <Table.Summary.Cell key={i} index={3 + i}>
                      <div style={{ textAlign: "center" }}>-</div>
                    </Table.Summary.Cell>
                  ))}
                  {/* Lesson sum columns */}
                  {lessons.map((lesson, i) => {
                    const lessonTotal = students.reduce((sum, st) => {
                      const val = entries[st.id]?.[lesson.id] ?? 0;
                      return sum + (val > 0 ? val : 0);
                    }, 0);
                    return (
                      <Table.Summary.Cell key={lesson.id} index={3 + prizes.length + i}>
                        <div style={{ 
                          textAlign: "center", 
                          fontWeight: 950, 
                          fontSize: "1.1rem",
                          color: lessonTotal > 0 ? "var(--color-star)" : "#adb5bd"
                        }}>
                          {lessonTotal}
                        </div>
                      </Table.Summary.Cell>
                    );
                  })}
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </div>

      <style jsx global>{`
        .management-grid .ant-table {
          background: #ffffff !important;
        }
        .management-grid .ant-table-thead > tr > th {
          background: #ffffff !important;
          border-bottom: 2px solid var(--color-border) !important;
          color: var(--color-text) !important;
          font-family: 'Montserrat', sans-serif !important;
          text-transform: uppercase;
          font-size: 0.85rem;
          padding: 16px 8px !important;
          letter-spacing: 0.5px;
          z-index: 10 !important;
        }
        /* Ensure sticky holder has solid background */
        .management-grid .ant-table-sticky-holder {
          background: #ffffff !important;
          z-index: 102 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border-bottom: 2px solid var(--color-border);
        }
        .management-grid .ant-table-header {
          background: #ffffff !important;
        }
        .management-grid .ant-table-container,
        .management-grid .ant-table-content,
        .management-grid .ant-table-body {
          border-radius: 0 !important;
        }
        .management-grid .ant-table-cell-fix-left {
          background: #ffffff !important;
          border-right: 1px solid #eee !important;
        }
        .management-grid .ant-table-cell-fix-left-last {
          border-right: 1px solid #eee !important;
        }
        .ant-table-bordered .ant-table-cell {
          border-right: 1px solid #eee !important;
          border-bottom: 1px solid #eee !important;
          padding: 12px 8px !important;
        }
        .ant-checkbox-inner {
          width: 22px;
          height: 22px;
          border: 2px solid var(--color-border);
        }
        .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #51cf66;
          border-color: #2b8a3e;
        }
        .prize-eligible-checkbox .ant-checkbox-inner {
          border-color: #51cf66 !important;
          border-width: 3px !important;
        }
        .score-select .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
        }
        .score-select:hover, .score-select:focus, .score-select-focused, .score-select-open {
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .score-select .ant-select-selection-item {
          font-size: 1.1rem;
          font-weight: 800;
        }
        .management-grid .ant-select-dropdown,
        .management-grid .ant-select-item {
          border-radius: 0 !important;
          box-shadow: none !important;
          border: 2px solid var(--color-border) !important;
        }
      `}</style>
    </div>
  );
}
