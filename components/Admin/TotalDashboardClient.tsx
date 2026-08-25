"use client";

import { useMemo, useState } from "react";
import { Table, Input, Tag } from "antd";
import { MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import type { Parallel } from "@/lib/admin/parallels";
import StarIcon from "@/components/StarIcon";
import BackButton from "@/components/BackButton";

interface StudentData {
  id: string;
  full_name: string;
  avatar_emoji: string;
  className: string;
  classCode: string;
  parallelId: string | null;
  totalStars: number;
}

const ALL = "__all__";

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: "20px",
    background: active ? "#000" : "#ffffff",
    color: active ? "#fff" : "#495057",
    fontWeight: 600,
    fontSize: "0.9rem",
    border: active ? "2px solid #000" : "2px solid #dee2e6",
    boxShadow: active ? "2px 2px 0px var(--color-star, #f59f00)" : "none",
    cursor: "pointer",
  };
}

export default function TotalDashboardClient({
  initialData,
  parallels,
}: {
  initialData: StudentData[];
  parallels: Parallel[];
}) {
  const [searchText, setSearchText] = useState("");
  // Паралель — назва "1".."12" (Етап 9), сортуємо числово: інакше "10" йде
  // перед "2" за звичайним рядковим порядком з БД. Порожні паралелі (жоден
  // учень/клас на них уже не посилається) ховаємо з чипів.
  const sortedParallels = useMemo(() => {
    const withData = new Set(initialData.map((s) => s.parallelId).filter(Boolean));
    return [...parallels]
      .filter((p) => withData.has(p.id))
      .sort((a, b) => Number(a.name) - Number(b.name));
  }, [parallels, initialData]);
  // За замовчуванням — перша паралель, якщо вона є: рейтинг усіх класів
  // разом рідко має сенс (див. фідбек продукту), паралель ближче до
  // реального питання «як мій 7 клас проти інших 7-х».
  const [parallelFilter, setParallelFilter] = useState<string>(
    sortedParallels[0]?.id ?? ALL
  );

  const scoped = useMemo(
    () =>
      parallelFilter === ALL
        ? initialData
        : initialData.filter((s) => s.parallelId === parallelFilter),
    [initialData, parallelFilter]
  );

  // Pre-calculate ranks based on scoped data (паралель або все, якщо паралелей нема)
  // Dense ranking: 1, 2, 2, 3... (no numbers skipped)
  const sortedUniqueStars = Array.from(new Set(scoped.map((s) => s.totalStars))).sort(
    (a, b) => b - a
  );

  const rankedData = scoped
    .map((st) => ({
      ...st,
      rank: sortedUniqueStars.indexOf(st.totalStars) + 1,
    }))
    .sort((a, b) => {
      // Primary sort: stars desc
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
      // Secondary sort: name asc
      return a.full_name.localeCompare(b.full_name);
    });

  const filteredData = rankedData.filter((item) =>
    item.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.className.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 60,
      align: "center" as const,
      sorter: (a: any, b: any) => a.rank - b.rank,
      render: (_value: unknown, record: StudentData & { rank: number }) => (
        <span style={{ fontWeight: 800, color: "#adb5bd" }}>{record.rank}</span>
      ),
    },
    {
      title: "УЧЕНЬ",
      key: "student",
      sorter: (a: StudentData, b: StudentData) => a.full_name.localeCompare(b.full_name),
      render: (record: StudentData) => (
        <Link href={`/admin/${record.classCode}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="student-profile-link" style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <span style={{ fontSize: "1.5rem" }}>{record.avatar_emoji}</span>
            <span style={{ fontWeight: 900, fontSize: "1rem" }} className="student-name-text">
              {record.full_name}
            </span>
          </div>
        </Link>
      ),
    },
    {
      title: "КЛАС",
      dataIndex: "className",
      key: "className",
      sorter: (a: StudentData, b: StudentData) => a.className.localeCompare(b.className),
      render: (text: string) => (
        <Tag color="#000" style={{ borderRadius: "6px", fontWeight: 800, textTransform: "uppercase" }}>
          {text}
        </Tag>
      ),
    },
    {
      title: "ЗІРКИ",
      dataIndex: "totalStars",
      key: "totalStars",
      align: "center" as const,
      sorter: (a: StudentData, b: StudentData) => a.totalStars - b.totalStars,
      defaultSortOrder: "descend" as const,
      render: (stars: number) => (
        <div style={{ 
          fontSize: "1.2rem", 
          fontWeight: 900, 
          color: "var(--color-star)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px"
        }}>
          {stars} <StarIcon size="0.9em" color="currentColor" />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container" style={{ maxWidth: "900px" }}>
      {sortedParallels.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setParallelFilter(ALL)}
            style={chipStyle(parallelFilter === ALL)}
          >
            Усі паралелі
          </button>
          {sortedParallels.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParallelFilter(p.id)}
              style={chipStyle(parallelFilter === p.id)}
            >
              {p.name} клас
            </button>
          ))}
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        marginBottom: "32px"
      }}>
        <BackButton href="/admin" label="Назад до кабінету" />
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 900, textTransform: "uppercase" }}>
          Рейтинг усіх учнів
        </h1>
      </div>

      <div style={{ marginBottom: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Input
          prefix={<MagnifyingGlass style={{ color: "#adb5bd" }} />}
          placeholder="Пошук учня або класу..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            flex: 1,
            minWidth: "200px",
            height: "50px",
            borderRadius: "12px",
            border: "2px solid #eee",
            fontSize: "1rem",
            fontWeight: 600
          }}
        />
      </div>

      <div className="star-card" style={{ padding: "0", overflow: "hidden" }}>
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          pagination={false}
          className="admin-total-table"
        />
      </div>

      <style jsx global>{`
        .admin-total-table .ant-table-thead > tr > th {
          background: #f8f9fa !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          font-size: 0.75rem !important;
          letter-spacing: 0.5px !important;
          padding: 16px !important;
          border-bottom: 2px solid #eee !important;
        }
        .admin-total-table .ant-table-cell {
          padding: 16px !important;
          border-bottom: 1px solid #f1f3f5 !important;
        }
        .admin-total-table .ant-table-row:hover .ant-table-cell {
          background: #fdfaf5 !important;
        }
        .student-profile-link:hover .student-name-text {
          color: #1890ff;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
