"use client";

import { useMemo, useState } from "react";
import { Button, Popconfirm, Space, Table, Tag, message } from "antd";
import { ArrowLeft, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { getSupabaseClient } from "@/lib/supabase/client";
import { adminApiFetch } from "@/lib/admin/adminApiFetch";
import { entryTypeLabel, type EntryType } from "@/lib/admin/classConfig";

/**
 * Історія нарахувань поза журналом.
 *
 * Групове нарахування — це N рядків зі спільним batch_id (fan-out, див.
 * /api/admin/entry). У таблиці вони СХЛОПУЮТЬСЯ в один рядок: вчитель зробив
 * одну дію, і скасувати мусить одну дію, а не двадцять окремих записів.
 */

export interface HistoryRow {
  id: string;
  student_id: string | null;
  entry_type_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  scope: string;
  group_id: string | null;
  batch_id: string | null;
  students?: { full_name: string; avatar_emoji: string } | null;
}

interface DisplayRow {
  key: string;
  /** id одного запису або null, якщо це схлопнута групова операція */
  entryId: string | null;
  batchId: string | null;
  entryTypeId: string;
  amount: number;
  note: string | null;
  createdAt: string;
  scope: string;
  groupId: string | null;
  studentName: string | null;
  studentEmoji: string | null;
  memberCount: number;
}

function collapse(rows: HistoryRow[]): DisplayRow[] {
  const out: DisplayRow[] = [];
  const batchSeen = new Map<string, DisplayRow>();

  for (const r of rows) {
    if (r.batch_id) {
      const existing = batchSeen.get(r.batch_id);
      if (existing) {
        existing.memberCount += 1;
        continue;
      }
      const row: DisplayRow = {
        key: `batch:${r.batch_id}`,
        entryId: null,
        batchId: r.batch_id,
        entryTypeId: r.entry_type_id,
        amount: r.amount,
        note: r.note,
        createdAt: r.created_at,
        scope: r.scope,
        groupId: r.group_id,
        studentName: null,
        studentEmoji: null,
        memberCount: 1,
      };
      batchSeen.set(r.batch_id, row);
      out.push(row);
      continue;
    }

    out.push({
      key: r.id,
      entryId: r.id,
      batchId: null,
      entryTypeId: r.entry_type_id,
      amount: r.amount,
      note: r.note,
      createdAt: r.created_at,
      scope: r.scope,
      groupId: r.group_id,
      studentName: r.students?.full_name ?? null,
      studentEmoji: r.students?.avatar_emoji ?? null,
      memberCount: 1,
    });
  }

  return out;
}

export default function EntryHistoryClient({
  classCode,
  className,
  rows,
  entryTypes,
  groups,
}: {
  classCode: string;
  className: string;
  rows: HistoryRow[];
  entryTypes: EntryType[];
  groups: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const typeById = useMemo(
    () => new Map(entryTypes.map((t) => [t.id, t] as const)),
    [entryTypes]
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name] as const)),
    [groups]
  );

  const data = useMemo(() => collapse(rows), [rows]);

  async function remove(row: DisplayRow) {
    setDeleting(row.key);
    const query = row.batchId
      ? `batch_id=${row.batchId}`
      : `id=${row.entryId}`;
    try {
      const res = await adminApiFetch(supabase, `/api/admin/entry?${query}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Помилка");
      message.success(row.batchId ? "Операцію скасовано" : "Запис видалено");
      router.refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Не вдалося видалити");
    } finally {
      setDeleting(null);
    }
  }

  const columns = [
    {
      title: "Кому",
      key: "target",
      render: (_v: unknown, row: DisplayRow) => {
        if (row.batchId) {
          const name = row.groupId ? groupNameById.get(row.groupId) : null;
          return (
            <Tag color="purple" style={{ fontWeight: 600 }}>
              {name ? `Група «${name}»` : "Група"} · {row.memberCount} учнів
            </Tag>
          );
        }
        if (!row.studentName) {
          return (
            <Tag color="blue" style={{ fontWeight: 600 }}>
              Увесь клас
            </Tag>
          );
        }
        return (
          <Space>
            <span style={{ fontSize: "1.2rem" }}>{row.studentEmoji}</span>
            <span style={{ fontWeight: 600 }}>{row.studentName}</span>
          </Space>
        );
      },
    },
    {
      title: "Тип",
      key: "type",
      width: 170,
      render: (_v: unknown, row: DisplayRow) => {
        const type = typeById.get(row.entryTypeId);
        if (!type) return <span style={{ color: "#adb5bd" }}>—</span>;
        return (
          <span style={{ fontWeight: 600, color: type.color ?? undefined }}>
            {entryTypeLabel(type)}
            {type.deleted_at && (
              <span style={{ color: "#adb5bd", fontWeight: 600 }}> (сховано)</span>
            )}
          </span>
        );
      },
    },
    {
      title: "Зірки",
      key: "amount",
      width: 110,
      render: (_v: unknown, row: DisplayRow) => {
        const isNeg = row.amount < 0;
        return (
          <span
            style={{
              fontWeight: 900,
              fontSize: "1.1rem",
              color: isNeg ? "#e03131" : "#f08c00",
            }}
          >
            {isNeg ? "" : "+"}
            {row.amount} ⭐{row.memberCount > 1 ? " кожному" : ""}
          </span>
        );
      },
    },
    {
      title: "Причина",
      dataIndex: "note",
      key: "note",
      render: (note: string | null) => note || <span style={{ color: "#ccc" }}>—</span>,
    },
    {
      title: "Дата",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => format(new Date(date), "d MMM, HH:mm", { locale: uk }),
    },
    {
      title: "",
      key: "actions",
      width: 70,
      render: (_v: unknown, row: DisplayRow) => (
        <Popconfirm
          title={row.batchId ? "Скасувати всю операцію?" : "Видалити цей запис?"}
          description={
            row.batchId
              ? `Буде видалено ${row.memberCount} нарахувань, зроблених разом.`
              : undefined
          }
          onConfirm={() => remove(row)}
          okText="Так"
          cancelText="Ні"
        >
          <Button
            danger
            icon={<Trash />}
            loading={deleting === row.key}
            className="btn-danger-outline"
            style={{ padding: "4px 12px" }}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page-container" style={{ maxWidth: "1000px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link
          href={`/admin/${classCode}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 800,
            padding: "8px 16px",
            border: "2px solid #000",
            borderRadius: "10px",
            textDecoration: "none",
            background: "#000",
          }}
        >
          <ArrowLeft /> Назад до журналу
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 900 }}>🕒 Історія {className}</h1>
        <p className="subtitle" style={{ fontSize: "1.1rem" }}>
          Нарахування поза журналом уроків
        </p>
      </div>

      <div className="star-card" style={{ padding: "0", overflow: "hidden", borderRadius: "16px" }}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="key"
          pagination={{ pageSize: 20 }}
          size="large"
          locale={{ emptyText: "Історія порожня" }}
        />
      </div>
    </div>
  );
}
