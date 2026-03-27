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
    const diff = amount - oldAmount;

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
      message.error("Помилка автозбереження");
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
      message.error("Помилка збереження нагороди");
      setGivenPrizes((prev) => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [prizeId]: prevVal },
      }));
    }
  };

  const columns = [
    {
      title: <div style={{ fontSize: "0.8rem", color: "#888" }}>#</div>,
      key: "index",
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
      fixed: "left" as const,
      align: "center" as const,
    },
    {
      title: <Space><UserOutlined /> УЧЕНЬ</Space>,
      key: "student",
      fixed: "left" as const,
      width: 220,
      render: (_: any, record: Student) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>{record.avatar_emoji}</span>
          <div style={{ lineHeight: "1.2" }}>
            <div style={{ fontWeight: 850, fontSize: "0.95rem" }}>{record.full_name}</div>
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
          color: "var(--color-text)",
          background: "#fff9db",
          padding: "4px 8px",
          borderRadius: "8px",
          border: "2px solid #fcc419"
        }}>
          {totalStars[record.id] ?? 0}
        </div>
      )
    },
    ...prizes.map(prize => ({
      title: <div style={{ fontSize: "1.2rem" }} title={prize.name}>{prize.emoji}</div>,
      key: `prize_${prize.id}`,
      width: 60,
      align: "center" as const,
      render: (_: any, record: Student) => (
        <Checkbox 
          checked={givenPrizes[record.id]?.[prize.id] ?? false}
          onChange={(e) => handlePrizeToggle(record.id, prize.id, e.target.checked)}
          style={{ transform: "scale(1.2)" }}
        />
      )
    })),
    ...lessons.map(lesson => ({
      title: <div style={{ fontWeight: 800 }}>{dayjs(lesson.date).format("DD.MM")}</div>,
      key: lesson.id,
      width: 90,
      align: "center" as const,
      render: (_: any, record: Student) => (
        <Select
          value={entries[record.id]?.[lesson.id] ?? 0}
          onChange={(val) => handleStarChange(record.id, lesson.id, val)}
          options={STAR_OPTIONS}
          variant="borderless"
          popupMatchSelectWidth={false}
          style={{ width: "100%", fontWeight: 700, fontSize: "1rem", color: "#000000" }}
        />
      )
    }))
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "120px" }}>
        <Spin size="large" description="Завантаження журналу..." />
      </div>
    );
  }

  return (
    <div style={{ background: "#ffffff", width: "100%" }}>
      <div style={{ padding: "0" }} className="full-width-table">
        <Table
          dataSource={students}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: "max-content", y: "calc(100vh - 120px)" }}
          size="middle"
          bordered
          sticky
          className="management-grid"
        />
      </div>

      <style jsx global>{`
        .management-grid .ant-table {
          background: #ffffff !important;
        }
        .management-grid .ant-table-thead > tr > th {
          background: #f8f9fa !important;
          border-bottom: 2px solid var(--color-border) !important;
          color: var(--color-text) !important;
          font-family: 'Montserrat', sans-serif !important;
          text-transform: uppercase;
          font-size: 0.75rem;
          padding: 12px 8px !important;
          letter-spacing: 0.5px;
        }
        .management-grid .ant-table-container,
        .management-grid .ant-table-content,
        .management-grid .ant-table-body {
          border-radius: 0 !important;
        }
        .management-grid .ant-table-wrapper,
        .management-grid .ant-table {
          border-radius: 0 !important;
        }
        .management-grid .ant-table-cell-fix-left {
          background: #ffffff !important;
          border-right: 2px solid #eee !important;
        }
        .management-grid .ant-table-cell-fix-left-last {
          border-right: 3px solid var(--color-border) !important;
        }
        .ant-table-bordered .ant-table-cell {
          border-right: 1px solid #eee !important;
          border-bottom: 1px solid #eee !important;
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
        .full-width-table .ant-table-body {
          scrollbar-width: thin;
        }
        .management-grid .ant-select-selector {
          border: 1px solid #d9d9d9 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #fff !important;
        }
        .management-grid .ant-select-focused .ant-select-selector,
        .management-grid .ant-select-open .ant-select-selector {
          border-color: #1677ff !important;
          box-shadow: none !important;
        }
        .management-grid .ant-select {
          border-radius: 0 !important;
        }
        .management-grid .ant-select-dropdown,
        .management-grid .ant-select-item {
          border-radius: 0 !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}
