import { notFound } from "next/navigation";
import ManagementTable from "@/components/Admin/ManagementTable";
import BackButton from "@/components/BackButton";
import { getDemoClassByCode, getDemoJournal } from "@/lib/demo/demoData";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

/**
 * Журнал демо-класу: той самий ManagementTable, що й у вчителя
 * (app/admin/[classId]/page.tsx), з тими самими даними в тій самій формі.
 *
 * demoMode лишає таблицю повністю клікабельною: зірки ставляться, суми
 * перераховуються, нагороди відмічаються, але запит на запис не йде. Тобто
 * гість бачить, як це працює, і не може зіпсувати спільні демо-дані.
 * Перезавантаження сторінки повертає все як було.
 *
 * getDemoClassByCode віддає клас ЛИШЕ з is_public_demo = true, тож підставити
 * сюди код справжнього класу і відкрити чужий журнал не вийде.
 */
export default async function DemoClassPage({ params }: Props) {
  const { classId: classParam } = await params;

  const cls = await getDemoClassByCode(classParam);
  if (!cls) return notFound();

  const journalInitial = await getDemoJournal(cls.id);
  if (!journalInitial) return notFound();

  return (
    <div style={{ padding: 0, minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div
        style={{
          background: "#ffffff",
          borderBottom: "3px solid var(--color-border)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <BackButton href="/demo" label="Назад до кабінету" />
          <div style={{ width: "2px", height: "24px", background: "#e9ecef" }} />
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 900,
              margin: 0,
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            {cls.name}
          </h1>
        </div>

        {/* Замість тулбару вчителя (швидке нарахування, новий урок,
            налаштування, нагороди, QR) тут чесна мітка: ті екрани живуть у
            власному кабінеті, і кнопки, які ведуть на форму входу, гірші за
            їхню відсутність. */}
        <span
          style={{
            padding: "6px 14px",
            borderRadius: "20px",
            border: "2px solid #000",
            background: "var(--color-star)",
            fontWeight: 800,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Демо, спробуйте натиснути на клітинку
        </span>
      </div>

      <div style={{ width: "100%", padding: "24px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
            border: "3px solid #000000",
            overflow: "hidden",
          }}
        >
          <ManagementTable
            key={cls.id}
            classId={cls.id}
            initialData={journalInitial}
            demoMode
          />
        </div>
      </div>
    </div>
  );
}
