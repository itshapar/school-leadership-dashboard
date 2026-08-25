import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTeacherStudentView } from "@/lib/admin/teacherStudentView";
import PersonalDashboardClient from "@/components/PersonalDashboardClient";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ from?: string }>;
}

/**
 * Дашборд учня очима вчителя (живий фідбек).
 *
 * Маршрут навмисно в /admin: сторінка вимагає сесію вчителя, а дані
 * читаються під його ж RLS — чужий учень просто не знайдеться. Публічний
 * /class/[code]/student/[id] лишається закритим редіректом, як і після
 * Етапу 9.12: учень не має відкривати чужі дашборди навіть за прямим
 * посиланням.
 *
 * ?from=код класу — щоб «назад» вело туди, звідки прийшли: журнал класу
 * чи загальний рейтинг.
 */
export default async function TeacherStudentPage({ params, searchParams }: Props) {
  const { studentId } = await params;
  const { from } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const view = await loadTeacherStudentView(supabase, studentId);
  if (!view) return notFound();

  const givenPrizes: Record<string, boolean> = {};
  for (const prizeId of view.givenPrizeIds) {
    givenPrizes[prizeId] = true;
  }

  const backHref = from === "total" ? "/admin/total" : `/admin/${view.classCode}`;

  return (
    <div className="page-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <BackButton
          href={backHref}
          label={from === "total" ? "Назад до рейтингу" : "Назад до журналу"}
        />
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 900,
              fontSize: "1.4rem",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            {view.student.fullName}
          </h1>
          <div style={{ color: "#868e96", fontWeight: 600, fontSize: "0.85rem" }}>
            {view.className}
            {view.student.nickname ? ` · ${view.student.nickname}` : ""}
          </div>
        </div>
      </div>

      {/* Прямо кажемо вчителю, що він дивиться чужий екран, а не свій:
          нижче йде рівно те, що бачить сам учень за власним PIN. */}
      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          borderRadius: 12,
          boxShadow: "4px 4px 0px #000",
          padding: "10px 14px",
          marginBottom: 20,
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "#495057",
        }}
      >
        Так цю сторінку бачить сам учень після входу за власним PIN.
      </div>

      <PersonalDashboardClient
        student={{
          id: view.student.id,
          display_name: view.student.displayName,
          avatar_emoji: view.student.avatarEmoji,
        }}
        totalStars={view.totalStars}
        individualStars={view.totalStars}
        rank={view.rank}
        totalStudents={view.totalStudents}
        prizes={view.prizes}
        givenPrizes={givenPrizes}
        history={view.history}
        classId={view.classId}
      />
    </div>
  );
}
