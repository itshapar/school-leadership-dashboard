import { redirect } from "next/navigation";
import Link from "next/link";
import PersonalDashboardClient from "@/components/PersonalDashboardClient";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getPublicStudentDashboard } from "@/lib/public/classData";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string; studentId: string }>;
}

export default async function StudentDashboardPage({ params }: Props) {
  const { classId: classParam, studentId } = await params;

  // RPC сама перевіряє, що учень належить саме цьому класу, і повертає NULL
  // і для неіснуючого коду, і для чужого student_id — без різниці назовні.
  // Після міграції 024 (Фаза B Етапу 4) anon втрачає цю RPC взагалі —
  // тоді старі посилання м'яко ведуть на вхід за PIN (/me).
  const data = await getPublicStudentDashboard(classParam, studentId);
  if (!data) redirect(`/class/${classParam}/me`);

  if (data.public_code.toUpperCase() !== classParam.toUpperCase().replace(/[^A-Z0-9]/g, "")) {
    redirect(`/class/${data.public_code}/student/${studentId}`);
  }

  const givenPrizes: Record<string, boolean> = {};
  for (const prizeId of data.given_prize_ids ?? []) {
    givenPrizes[prizeId] = true;
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: "8px" }}>
        <Link
          href={`/class/${data.public_code}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            color: "#ffffff",
            fontSize: "1.2rem",
            textDecoration: "none",
            background: "#000000",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <ArrowLeftOutlined />
        </Link>
      </div>

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
    </div>
  );
}
