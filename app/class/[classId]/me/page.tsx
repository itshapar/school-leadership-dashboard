import { notFound, redirect } from "next/navigation";
import PersonalDashboardClient from "@/components/PersonalDashboardClient";
import PersonalDashboardIntroToast from "@/components/PersonalDashboardIntroToast";
import StudentPinLogin from "@/components/StudentPinLogin";
import StudentLogoutButton from "@/components/StudentLogoutButton";
import { getPublicClassOverview } from "@/lib/public/classData";
import { getStudentDashboardFromSession } from "@/lib/studentSession";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ blocked?: string }>;
}

/**
 * «Мій дашборд» учня (Етап 4): вхід «код класу + PIN» один раз →
 * довгоживуча сесія на пристрої. Без валідної сесії — форма PIN.
 *
 * У URL немає student_id: кого показувати, вирішує сесія (httpOnly-cookie),
 * тому підмінити чужий id неможливо. Це закриває залишковий ризик Етапу 1
 * («однокласник бачить чужу сторінку»), як тільки застосується міграція 024.
 *
 * ?blocked=1 (Етап 9.12-9.13, живий фідбек): сюди веде і старий маршрут
 * /class/[code]/student/[id], коли хтось намагався відкрити ЧУЖИЙ
 * персональний дашборд напряму — тепер це завжди редіректить на власний
 * /me за сесією, а PersonalDashboardIntroToast показує спливне пояснення
 * чому саме (звичайний вхід теж отримує коротке нагадування, раз на сесію
 * браузера).
 */
export default async function MyDashboardPage({ params, searchParams }: Props) {
  const { classId: classParam } = await params;
  const { blocked } = await searchParams;

  const overview = await getPublicClassOverview(classParam);
  if (!overview) return notFound();
  if (overview.requested_legacy) {
    redirect(`/class/${overview.public_code}/me`);
  }

  const data = await getStudentDashboardFromSession();

  if (!data) {
    return (
      <div className="page-container">
        <StudentPinLogin code={overview.public_code} className={overview.name} />
      </div>
    );
  }

  // Сесія іншого класу (напр., брат/сестра на тому ж телефоні) —
  // ведемо учня на дашборд ЙОГО класу.
  if (data.public_code !== overview.public_code) {
    redirect(`/class/${data.public_code}/me`);
  }

  const givenPrizes: Record<string, boolean> = {};
  for (const prizeId of data.given_prize_ids ?? []) {
    givenPrizes[prizeId] = true;
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: "8px" }}>
        <BackButton href={`/class/${data.public_code}`} label="Назад до класу" />
      </div>

      <PersonalDashboardIntroToast blocked={blocked === "1"} />

      <PersonalDashboardClient
        student={data.student}
        totalStars={data.total_stars}
        individualStars={data.total_stars}
        rank={data.rank}
        totalStudents={data.total_students}
        prizes={data.prizes ?? []}
        givenPrizes={givenPrizes}
        history={data.history ?? []}
        classId={data.class_id}
      />

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <StudentLogoutButton />
      </div>
    </div>
  );
}
