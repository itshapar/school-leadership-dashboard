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

  // Sync state when initialData changes (e.g. after router.refresh())
  useEffect(() => {
    if (initialData) {
      applyJournalState(initialData, {
        setStudents,
        setLessons,
        setPrizes,
        setEntries,
        setGivenPrizes,
        setTotalStars,
      });
    }
  }, [initialData]);

  // Auto-save star amount (через API з серверною сесією — RLS у Supabase для запису)
  const handleStarChange = async (studentId: string, lessonId: string, amount: number) => {
    const oldAmount = entries[studentId]?.[lessonId] ?? 0;
    const getStarsVal = (v: number) => (v === -1 ? 0 : v);
    const diff = getStarsVal(amount) - getStarsVal(oldAmount);

    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [lessonId]: amount },
    }));
    setTotalStars((prev) => {
      const current = prev[studentId] ?? 0;
      return {
        ...prev,
        [studentId]: current + diff,
      };
    });

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
      render: (_value: unknown, _record: Student, index: number) => (
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
      render: (_value: unknown, record: Student) => (
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
      render: (_value: unknown, record: Student) => (
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
      const titleText = prize.name;
      return {
        title: <div style={{ fontSize: "0.8rem", fontWeight: 900, whiteSpace: "nowrap" }} title={prize.name}>{titleText}</div>,
        key: `prize_${prize.id}`,
        width: 100,
        align: "center" as const,
        onCell: () => ({ style: { padding: 0 } }),
        render: (_value: unknown, record: Student) => {
          const isUnlocked = (totalStars[record.id] ?? 0) >= prize.stars_required;
          const isGiven = givenPrizes[record.id]?.[prize.id] ?? false;
          return (
            <div style={{
              height: "100%",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              transition: "all 0.2s"
            }}>
              <Checkbox
                checked={isGiven}
                onChange={(e) => handlePrizeToggle(record.id, prize.id, e.target.checked)}
                className={isUnlocked && !isGiven ? "prize-checkbox prize-eligible" : "prize-checkbox"}
                style={{ transform: "scale(1.15)" }}
              />
            </div>
          );

        }
      };
    }),
    ...lessons.map((lesson, idx) => {
      const lessonDate = dayjs(lesson.date);
      const isToday = dayjs().isSame(lessonDate, "day");
      const isHighlighted = isToday || (idx === lessons.length - 1 && lessonDate.isBefore(dayjs()));
      
      return {
        title: (
          <div style={{
            fontWeight: 800,
            border: "none",
            color: "#000000",
            width: "100%",
            fontSize: "0.85rem"
          }}>
            {lessonDate.format("DD.MM")}
          </div>
        ),
        key: lesson.id,
        width: 80,
        align: "center" as const,
        onCell: () => ({
          style: {
            background: isHighlighted ? "#f1f3f5" : "inherit"
          }
        }),
        render: (_value: unknown, record: Student) => {
          const score = entries[record.id]?.[lesson.id] ?? 0;
          return (
            <Select
              value={score}
              onChange={(val) => handleStarChange(record.id, lesson.id, val)}
              bordered={false}
              className="score-select"
              style={{
                width: "100%",
                fontWeight: 900,
                color: score > 0 ? "#000000" : (score === -1 ? "#fa5252" : (score < 0 ? "#fa5252" : "#adb5bd"))
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
    <div style={{ background: "#ffffff", width: "100%", height: "100%" }}>
      <div style={{ padding: "0" }} className="full-width-table">
        <Table
          dataSource={students}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content", y: "calc(100vh - 260px)" }}
          size="middle"
          className="management-grid"
          summary={() => {
            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row style={{ background: "#f8f9fa" }}>
                  <Table.Summary.Cell index={0} className="sticky-summary-cell">
                    <div style={{ textAlign: "center", fontWeight: 950, color: "#adb5bd" }}>Σ</div>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} className="sticky-summary-cell">
                    <div style={{ fontWeight: 950, textTransform: "uppercase", fontSize: "0.8rem", color: "#495057" }}>За урок:</div>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} className="sticky-summary-cell">
                    <div style={{ textAlign: "center", fontWeight: 950, color: "#adb5bd" }}>-</div>
                  </Table.Summary.Cell>
                  {/* Prize columns (empty sum) */}
                  {prizes.map((_, i) => (
                    <Table.Summary.Cell key={i} index={3 + i} className="sticky-summary-cell">
                      <div style={{ textAlign: "center", color: "#adb5bd" }}>-</div>
                    </Table.Summary.Cell>
                  ))}
                  {/* Lesson sum columns */}
                  {lessons.map((lesson, i) => {
                    const lessonTotal = students.reduce((sum, st) => {
                      const val = entries[st.id]?.[lesson.id] ?? 0;
                      return sum + (val > 0 ? val : 0);
                    }, 0);
                    return (
                      <Table.Summary.Cell key={lesson.id} index={3 + prizes.length + i} className="sticky-summary-cell">
                        <div style={{ 
                          textAlign: "center", 
                          fontWeight: 950, 
                          fontSize: "1.1rem",
                          color: lessonTotal > 0 ? "#2b8a3e" : "#adb5bd",
                          textShadow: lessonTotal > 0 ? "0 0 10px rgba(43,138,62,0.1)" : "none"
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
        /* =========================================================
         * MANAGEMENT GRID — єдина система бордерів без дублювання
         * ========================================================= */

        /* Base table reset */
        .management-grid,
        .management-grid .ant-table-wrapper,
        .management-grid .ant-table,
        .management-grid .ant-table-container,
        .management-grid .ant-table-content,
        .management-grid .ant-table-body,
        .management-grid .ant-table-header {
          border: none !important;
          outline: none !important;
          margin: 0 !important;
          border-radius: 0 !important;
        }

        .management-grid .ant-table {
          background: #ffffff !important;
        }

        /* ── Sticky header ──────────────────────────────────────────
         * ant-table-sticky-holder є окремим DOM-вузлом, що рендериться
         * ПОВЕРХ thead. Якщо і sticky-holder, і th мають border-bottom,
         * вони накладаються і дають «жиру» лінію при певних viewport-ах.
         * Рішення: border ТІЛЬКИ на th, sticky-holder — без border.
         * ─────────────────────────────────────────────────────────── */
        .management-grid .ant-table-sticky-holder {
          background: #ffffff !important;
          z-index: 102 !important;
          /* Жодного border тут — single source of truth на th нижче */
          border: none !important;
          box-shadow: none !important;
        }

        .management-grid .ant-table-thead > tr > th {
          background: #ffffff !important;
          /* Єдиний бордер знизу заголовку таблиці */
          border-bottom: 2px solid #2C2C2C !important;
          border-top: none !important;
          border-right: 1px solid #e9ecef !important;
          color: var(--color-text) !important;
          font-family: 'Montserrat', sans-serif !important;
          text-transform: uppercase;
          font-size: 0.85rem;
          padding: 16px 8px !important;
          letter-spacing: 0.5px;
          z-index: 10 !important;
        }

        /* ── Body cells ─────────────────────────────────────────── */
        .management-grid .ant-table-tbody > tr > td {
          border-bottom: 1px solid #e9ecef !important;
          border-right: 1px solid #e9ecef !important;
          padding: 12px 8px !important;
          outline: none !important;
        }
        .management-grid .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }

        /* ── Sticky fixed columns ───────────────────────────────── */
        .management-grid .ant-table-cell-fix-left {
          background: #ffffff !important;
        }
        .management-grid .ant-table-cell-fix-left-last {
          border-right: 1px solid #dee2e6 !important;
        }

        /* ── Scroll ping shadows → вимкнути, вони виглядають як товсті лінії ── */
        .management-grid .ant-table-cell-fix-left-last::after,
        .management-grid .ant-table-cell-fix-right-first::after,
        .ant-table-ping-left .ant-table-cell-fix-left-last::after,
        .ant-table-ping-right .ant-table-cell-fix-right-first::after {
          box-shadow: none !important;
          border: none !important;
          opacity: 0 !important;
          content: none !important;
        }

        /* ── Summary row ────────────────────────────────────────── */
        .management-grid .ant-table-summary {
          border-top: none !important;
        }
        .sticky-summary-cell {
          background: #ffffff !important;
          border-top: 2px solid #2C2C2C !important;
          border-bottom: none !important;
          padding: 16px 8px !important;
          z-index: 10 !important;
        }

        /* ── Checkboxes ─────────────────────────────────────────── */
        .ant-checkbox-inner {
          width: 22px;
          height: 22px;
          border: 2px solid var(--color-border);
        }
        .ant-checkbox-wrapper:hover .ant-checkbox-inner,
        .ant-checkbox:hover .ant-checkbox-inner {
          border-color: #dee2e6 !important;
        }
        .ant-checkbox-checked .ant-checkbox-inner {
          background-color: #51cf66 !important;
          border-color: #2b8a3e !important;
        }
        .prize-checkbox.prize-eligible .ant-checkbox-inner {
          border-color: #2b8a3e !important;
          border-width: 2px !important;
          box-shadow: 0 0 8px rgba(43,138,62,0.6) !important;
          background-color: #ffffff !important;
        }
        .prize-checkbox.prize-eligible.ant-checkbox-wrapper-checked .ant-checkbox-inner {
          background-color: #51cf66 !important;
          border-width: 2px !important;
          box-shadow: none !important;
        }

        /* ── Score select ───────────────────────────────────────── */
        .score-select .ant-select-selector,
        .score-select:hover .ant-select-selector,
        .score-select-focused .ant-select-selector,
        .score-select-open .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: transparent !important;
        }
        .score-select,
        .ant-select,
        .ant-select-selector {
          box-shadow: none !important;
          outline: none !important;
        }
        .score-select .ant-select-selection-item {
          font-size: 2rem !important;
          font-weight: 950 !important;
          color: inherit !important;
        }

        /* ── Dropdown ───────────────────────────────────────────── */
        .management-grid .ant-select-dropdown,
        .management-grid .ant-select-item {
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          border: 1px solid #eee !important;
        }
        .management-grid .ant-select-item-option-content {
          font-size: 1.5rem !important;
          font-weight: 800 !important;
          padding: 8px 0 !important;
        }
      `}</style>
    </div>
  );
}
