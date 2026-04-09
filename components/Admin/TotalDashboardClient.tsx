"use client";

import { useState } from "react";
import { Table, Input, Space, Button, Tag } from "antd";
import { StarFilled, SearchOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";

interface StudentData {
  id: string;
  full_name: string;
  avatar_emoji: string;
  className: string;
  totalStars: number;
}

export default function TotalDashboardClient({ initialData }: { initialData: StudentData[] }) {
  const [searchText, setSearchText] = useState("");

  const filteredData = initialData.filter((item) =>
    item.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.className.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 60,
      align: "center" as const,
      render: (_value: unknown, _record: StudentData, index: number) => (
        <span style={{ fontWeight: 800, color: "#adb5bd" }}>{index + 1}</span>
      ),
    },
    {
      title: "УЧЕНЬ",
      key: "student",
      sorter: (a: StudentData, b: StudentData) => a.full_name.localeCompare(b.full_name),
      render: (record: StudentData) => (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.5rem" }}>{record.avatar_emoji}</span>
          <span style={{ fontWeight: 850, fontSize: "1rem" }}>{record.full_name}</span>
        </div>
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

      <div style={{ marginBottom: "24px" }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#adb5bd" }} />}
          placeholder="Пошук учня або класу..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ 
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
      `}</style>
    </div>
  );
}
