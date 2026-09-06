"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Spin, Table, Tag, message } from "antd";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  copyPrizesToClass,
  loadPrizeLibrary,
  type PrizeKind,
  type PrizeTemplate,
} from "@/lib/admin/prizeLibrary";
import StarIcon from "@/components/StarIcon";

/**
 * «Скопіювати нагороду»: вибір із нагород, які вчитель уже завів в інших своїх
 * класах (живий фідбек).
 *
 * Раніше кожен новий клас починався з порожнього списку, і ті самі «Кіндер» чи
 * «Pizza day» доводилось набирати руками для кожного класу. Тут вибір
 * множинний: клас зазвичай переносять цілим набором нагород, а не по одній.
 *
 * Бібліотека збирається з самих нагород (lib/admin/prizeLibrary), окремої
 * таблиці шаблонів немає, тож список завжди відповідає тому, чим вчитель
 * реально користується зараз.
 */
interface Props {
  open: boolean;
  classId: string;
  kind: PrizeKind;
  /** Назви нагород поточного класу: такі в списку є, але вимкнені. */
  existingNames: string[];
  /** Скільки нагород ще влазить у ліміт класу. */
  remaining: number;
  onClose: () => void;
  onCopied: () => void;
  /** Наступний sort_order: копії стають у кінець списку. */
  nextSortOrder: number;
}

export default function CopyPrizesModal({
  open,
  classId,
  kind,
  existingNames,
  remaining,
  onClose,
  onCopied,
  nextSortOrder,
}: Props) {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<PrizeTemplate[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const isIndividual = kind === "individual";

  /**
   * Назви нагород класу читаємо через ref, а не із замикання: батько віддає
   * новий масив на кожен рендер, у залежностях load він смикав би запит без
   * потреби, а без нього замикання застигало на першому значенні, і щойно
   * скопійовані нагороди не позначались як «уже в класі».
   */
  const existingRef = useRef(existingNames);
  useEffect(() => {
    existingRef.current = existingNames;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await loadPrizeLibrary(supabase, kind, classId, existingRef.current));
    } catch {
      message.error("Не вдалося завантажити попередні нагороди");
    } finally {
      setLoading(false);
    }
  }, [supabase, kind, classId]);

  useEffect(() => {
    if (!open) return;
    setSelectedKeys([]);
    void load();
  }, [open, load]);

  async function onOk() {
    const chosen = templates.filter((t) => selectedKeys.includes(t.key));
    if (chosen.length === 0) {
      message.info("Оберіть, які нагороди скопіювати");
      return;
    }
    if (chosen.length > remaining) {
      message.error(`Залишилось місце ще для ${remaining} нагород у цьому класі`);
      return;
    }

    setSaving(true);
    const { error, code } = await copyPrizesToClass(
      supabase,
      kind,
      classId,
      chosen,
      nextSortOrder
    );
    setSaving(false);

    if (error) {
      message.error(
        code === "23505"
          ? "Нагорода з такою назвою вже є в класі"
          : error.includes("Досягнуто ліміт")
          ? "Досягнуто ліміт нагород на клас"
          : "Не вдалося скопіювати нагороди"
      );
      return;
    }

    message.success(
      chosen.length === 1 ? "Нагороду скопійовано" : `Скопійовано нагород: ${chosen.length}`
    );
    onClose();
    onCopied();
  }

  const columns = [
    {
      title: "Нагорода",
      key: "name",
      render: (_v: unknown, row: PrizeTemplate) => (
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <span style={{ fontSize: "1.3rem" }}>{row.emoji}</span>
          {row.name}
          {row.alreadyHere && (
            <Tag style={{ fontWeight: 600, borderRadius: 6 }}>уже в класі</Tag>
          )}
        </span>
      ),
    },
    {
      title: "Кількість зірок",
      dataIndex: "threshold",
      key: "threshold",
      width: 150,
      align: "center" as const,
      render: (v: number) => (
        <span style={{ fontWeight: 900 }}>
          {v} <StarIcon />
        </span>
      ),
    },
    {
      title: "З класів",
      key: "classes",
      width: 200,
      render: (_v: unknown, row: PrizeTemplate) => (
        <span style={{ color: "#868e96", fontWeight: 600, fontSize: "0.8rem" }}>
          {row.classNames.join(", ")}
        </span>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ fontWeight: 900, textTransform: "uppercase" }}>Скопіювати нагороду</div>
      }
      open={open}
      onOk={onOk}
      onCancel={onClose}
      confirmLoading={saving}
      okText="Скопіювати"
      cancelText="Скасувати"
      okButtonProps={{ className: "btn-primary", disabled: loading || selectedKeys.length === 0 }}
      cancelButtonProps={{ className: "btn-secondary" }}
      width={720}
    >
      <div style={{ color: "#868e96", fontSize: "0.85rem", fontWeight: 600, margin: "8px 0 16px" }}>
        {isIndividual
          ? "Індивідуальні нагороди з інших ваших класів. Оберіть ті, які потрібні тут, назву й поріг потім можна відредагувати."
          : "Нагороди класу з інших ваших класів. Оберіть ті, які потрібні тут, назву й поріг потім можна відредагувати."}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <Table
          dataSource={templates}
          columns={columns}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ y: 340 }}
          className="prizes-table"
          locale={{
            emptyText:
              "Попередніх нагород ще немає. Створіть першу, і вона з'явиться тут для інших класів.",
          }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as string[]),
            getCheckboxProps: (row: PrizeTemplate) => ({ disabled: row.alreadyHere }),
          }}
        />
      )}
    </Modal>
  );
}
