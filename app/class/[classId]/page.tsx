import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ClassProgressBars from "@/components/ClassProgress";
import { StarFilled } from "@ant-design/icons";
import { getPublicClassOverview } from "@/lib/public/classData";
import { formatClassCode, isLegacyClassCode } from "@/lib/classCodes";
import LegacyCodeNotice from "@/components/LegacyCodeNotice";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function ClassPage({ params }: Props) {
  const { classId: classParam } = await params;

  // Публічний маршрут приймає ТІЛЬКИ код класу.
  // UUID більше не резолвиться: id класів передбачувані
  // (11111111-0000-0000-0000-00000000000N), тож прямий доступ за id був
  // окремою дірою поряд із перебором 4-значного коду.
  const overview = await getPublicClassOverview(classParam);

  // Старі 4-значні коди відключені (Етап 8). Дитина з роздрукованої торік
  // пам'ятки не має впертись у голий 404 — показуємо, що робити далі.
  //
  // Повідомлення однакове для БУДЬ-ЯКОГО 4-значного коду, і це навмисно:
  // перевіряється лише ФОРМАТ, а не існування класу, тож екран не працює
  // оракулом «такий клас є / такого немає».
  if (!overview && isLegacyClassCode(classParam)) {
    return <LegacyCodeNotice />;
  }
  if (!overview) return notFound();

  // Прийшли за старим кодом — тихо переводимо на новий.
  if (overview.requested_legacy) {
    redirect(`/class/${overview.public_code}`);
  }

  const students = overview.students ?? [];
  const classEntries = overview.class_entries ?? [];
  const classBonus = overview.class_bonus ?? 0;
  const totalClassStars = overview.total_stars ?? 0;

  return (
    <div className="page-container">
      <div style={{ marginBottom: "24px" }} />

      {overview.is_public_demo && (
        <Link href="/register" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "20px",
              padding: "14px 18px",
              background: "linear-gradient(135deg, #f5a623, #ffd700)",
              border: "3px solid #000000",
              borderRadius: "12px",
              boxShadow: "4px 4px 0px #000000",
              color: "#000000",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
              🎓 Це демонстраційний клас StarBoard — дані вигадані
            </span>
            <span style={{ fontWeight: 900, textDecoration: "underline", whiteSpace: "nowrap" }}>
              Зареєструватися безкоштовно →
            </span>
          </div>
        </Link>
      )}

      <div className="page-header">
        <h1 style={{ fontSize: "2.8rem", fontWeight: 900 }}>{overview.name}</h1>
      </div>

      {/* Total Class Stars Counter (Prominent) */}
      <div
        className="star-card"
        style={{
          textAlign: "center",
          marginBottom: "24px",
          padding: "32px",
          background: "#ffffff",
          border: "3px solid #000000",
          boxShadow: "4px 4px 0px #000000",
        }}
      >
        <div
          style={{
            fontSize: "5rem",
            fontWeight: 950,
            color: "var(--color-star)",
            lineHeight: 1,
            letterSpacing: "-2px",
          }}
        >
          {totalClassStars}{" "}
          <StarFilled
            style={{ fontSize: "3.5rem", verticalAlign: "middle", marginTop: "-10px" }}
          />
        </div>
      </div>

      {/* Class prize progress */}
      <div className="star-card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontWeight: 800,
            marginBottom: "20px",
            fontSize: "1.1rem",
            textTransform: "uppercase",
          }}
        >
          Прогрес нагород класу
        </div>
        <ClassProgressBars
          totalStars={totalClassStars}
          prizes={overview.class_prizes ?? []}
        />
      </div>

      {/* Collective History Card */}
      {(classBonus !== 0 || classEntries.length > 0) && (
        <div
          className="star-card"
          style={{
            marginBottom: "24px",
            background: "#ffffff",
            border: "3px solid #000000",
            boxShadow: "4px 4px 0px #000000",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase" }}>
              Колективні бонуси та штрафи
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 950,
                color: classBonus < 0 ? "#E03131" : "var(--color-star)",
                padding: "4px 12px",
                background: "#fff",
                borderRadius: "8px",
                border: "2px solid #000",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {classBonus > 0 ? "+" : ""}
              {classBonus} <StarFilled style={{ fontSize: "1.1rem" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {classEntries.slice(0, 5).map((entry, idx: number) => (
              <div
                key={idx}
                style={{
                  fontSize: "0.95rem",
                  color: "var(--color-text)",
                  fontWeight: 700,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: entry.amount < 0 ? "#FFF5F5" : "#F8F9FA",
                  border: "2px solid #000",
                  borderRadius: "8px",
                }}
              >
                <span>{entry.note || (entry.amount > 0 ? "Бонус класу" : "Штраф класу")}</span>
                <span style={{ color: entry.amount < 0 ? "#E03131" : "var(--color-star)" }}>
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount}
                </span>
              </div>
            ))}
            {classEntries.length > 5 && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                та ще {classEntries.length - 5} записів...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Мій дашборд: вхід за PIN один раз → довгоживуча сесія (Етап 4) */}
      <Link
        href={`/class/${overview.public_code}/me`}
        style={{ textDecoration: "none" }}
      >
        <div
          className="star-card"
          style={{
            marginBottom: "16px",
            padding: "20px 24px",
            background: "linear-gradient(135deg, #f5a623, #e8940f)",
            border: "3px solid #000000",
            boxShadow: "4px 4px 0px #000000",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#000000" }}>
              Мій дашборд
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#000000", opacity: 0.75 }}>
              Увійди зі своїм PIN — один раз
            </div>
          </div>
          <div style={{ fontSize: "2rem" }}>🔑</div>
        </div>
      </Link>

      {/*
        Список класу — за публічним іменем, без ПІБ і БЕЗ посилань.
        Раніше кожен рядок вів на /class/[code]/student/[id]. Після 024+026
        персональна сторінка вимагає PIN-сесію, тож ці посилання перетворились
        би на 19 однакових редіректів у форму PIN. Замість цього — один
        зрозумілий вхід «Мій дашборд» вище.
      */}
      <div className="star-card" style={{ padding: "24px 16px" }}>
        {students.map((student) => (
          <div key={student.id} className="leaderboard-row">
            <div style={{ fontSize: "1.8rem" }}>{student.avatar_emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 850, fontSize: "1.1rem", color: "#000000" }}>
                {student.display_name}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "24px",
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontSize: "0.8rem",
          fontWeight: 700,
        }}
      >
        Код класу: {formatClassCode(overview.public_code)}
      </div>
    </div>
  );
}
