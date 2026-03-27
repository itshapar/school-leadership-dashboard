"use client";

import { useState, useEffect } from "react";
import { Form, Select, InputNumber, Input, Button, Alert, message, Radio, Table, Tag, Popconfirm, Space } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { DeleteOutlined } from "@ant-design/icons";

interface Student {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_emoji: string;
}

interface StarEntry {
  id: string;
  student_id: string | null;
  type: string;
  amount: number;
  note: string | null;
  created_at: string;
  students?: {
    full_name: string;
    avatar_emoji: string;
  };
}

export default function AddBonusPage() {
  const params = useParams();
  const classId = params.classId as string;
  const [className, setClassName] = useState("");
  const [history, setHistory] = useState<StarEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    
    // Load class name
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
    if (cls) setClassName(cls.name);
    
    // Load history
    fetchHistory();
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("star_entries")
      .select(`
        id, 
        student_id, 
        type, 
        amount, 
        note, 
        created_at,
        students (full_name, avatar_emoji)
      `)
      .eq("class_id", classId)
      .in("type", ["bonus", "penalty"])
      .order("created_at", { ascending: false })
      .limit(50);
    
    setHistory((data as any) ?? []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  async function handleDelete(id: string) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("star_entries").delete().eq("id", id);
    if (error) {
      message.error("Помилка при видаленні");
    } else {
      message.success("Запис видалено");
      fetchHistory();
    }
  }

  const columns = [
    {
      title: "Кому",
      key: "target",
      render: (_: any, record: StarEntry) => {
        if (!record.student_id) return <Tag color="blue" style={{ fontWeight: 700 }}>Увесь клас</Tag>;
        return (
          <Space>
            <span style={{ fontSize: "1.2rem" }}>{record.students?.avatar_emoji}</span>
            <span style={{ fontWeight: 600 }}>{record.students?.full_name}</span>
          </Space>
        );
      }
    },
    {
      title: "Зірки",
      key: "amount",
      render: (_: any, record: StarEntry) => {
        const isNeg = record.amount < 0;
        return (
          <span style={{ fontWeight: 900, fontSize: "1.1rem", color: isNeg ? "#e03131" : "#f08c00" }}>
            {isNeg ? "" : "+"}{record.amount} ⭐
          </span>
        );
      }
    },
    {
      title: "Причина",
      dataIndex: "note",
      key: "note",
      render: (note: string) => note || <span style={{ color: "#ccc" }}>—</span>
    },
    {
      title: "Дата",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => format(new Date(date), "d MMM, HH:mm", { locale: uk })
    },
    {
      title: "",
      key: "actions",
      render: (_: any, record: StarEntry) => (
        <Popconfirm
          title="Видалити цей запис?"
          onConfirm={() => handleDelete(record.id)}
          okText="Так"
          cancelText="Ні"
        >
          <Button type="text" danger icon={<DeleteOutlined />} style={{ fontSize: "1.2rem" }} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="page-container" style={{ maxWidth: "900px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link href={`/admin/${classId}`} style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "8px",
          color: "var(--color-text)", 
          fontSize: "1rem", 
          fontWeight: 800,
          padding: "8px 16px",
          border: "2px solid var(--color-border)",
          borderRadius: "10px",
          textDecoration: "none",
          background: "#fff"
        }}>
          ← Назад до журналу
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 900 }}>🕒 Історія {className}</h1>
        <p className="subtitle" style={{ fontSize: "1.1rem" }}>Керування бонусами та штрафами</p>
      </div>

      <div className="star-card" style={{ padding: "0", overflow: "hidden", borderRadius: "16px" }}>
        <Table
          dataSource={history}
          columns={columns}
          rowKey="id"
          loading={historyLoading}
          pagination={{ pageSize: 20 }}
          size="large"
          locale={{ emptyText: "Історія порожня" }}
        />
      </div>
    </div>
  );
}
