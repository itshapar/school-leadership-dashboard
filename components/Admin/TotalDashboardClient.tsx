"use client";

import { useMemo, useState } from "react";
import { Table, Input, Select, Tag } from "antd";
import { StarFilled, SearchOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import type { Parallel } from "@/lib/admin/parallels";

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

export default function TotalDashboardClient({
  initialData,
  parallels,
}: {
  initialData: StudentData[];
  parallels: Parallel[];
}) {
  const [searchText, setSearchText] = useState("");
  // За замовчуванням — перша паралель, якщо вона є: рейтинг усіх класів
  // разом рідко має сенс (див. фідбек продукту), паралель ближче до
  // реального питання «як мій 7 клас проти інших 7-х».
  const [parallelFilter, setParallelFilter] = useState<string>(
    parallels[0]?.id ?? ALL
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
            <span style={{ fontWeight: 850, fontSize: "1rem" }} className="student-name-text">
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
        <Tag color="blue" style={{ borderRadius: "6px", fontWeight: 800, textTransform: "uppercase" }}>
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
          {stars} <StarFilled style={{ fontSize: "0.9rem" }} />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container" style={{ maxWidth: "900px" }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "20px", 
        marginBottom: "32px" 
      }}>
        <Link
          href="/admin"
          style={{
            background: "#000000",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            textShadow: "none"
          }}
        >
          <ArrowLeftOutlined />
        </Link>
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 900, textTransform: "uppercase" }}>
          Загальний дашборд
        </h1>
      </div>

      <div style={{ marginBottom: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {parallels.length > 0 && (
          <Select
            value={parallelFilter}
            onChange={setParallelFilter}
            style={{ height: "50px", minWidth: "160px" }}
            options={[
              { value: ALL, label: "Усі паралелі" },
              ...parallels.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}
        <Input
          prefix={<SearchOutlined style={{ color: "#adb5bd" }} />}
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
