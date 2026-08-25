import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getDemoTeacherView } from "@/lib/public/demoTeacherView";
import { PUBLIC_DEMO_CLASS_CODE } from "@/lib/publicDemo";
import DemoStudentList from "@/components/DemoStudentList";

export const dynamic = "force-dynamic";

/**
 * "Погляд вчителя" в демо: список учнів з розбивкою балів — хто скільки
 * отримав і за що. Без PIN-логіну (це не студентський флоу, це показ
 * можливостей продукту вчителю, який ще не зареєструвався).
 */
export default async function DemoStudentsPage() {
  const view = await getDemoTeacherView(PUBLIC_DEMO_CLASS_CODE);
  if (!view) return notFound();

  return (
    <div className="page-container">
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <Link
          href={`/class/${PUBLIC_DEMO_CLASS_CODE}`}
          style={{
            background: "#000000",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            borderRadius: "10px",
          }}
        >
          <ArrowLeftOutlined />
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, textTransform: "uppercase" }}>
          Учні: {view.name}
        </h1>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "14px 18px",
          background: "linear-gradient(135deg, #f5a623, #ffd700)",
          border: "3px solid #000000",
          borderRadius: "12px",
          boxShadow: "4px 4px 0px #000000",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>
          🎓 Так вчитель бачить, за що кожен учень отримав бали
        </span>
        <Link href="/register" style={{ fontWeight: 900, textDecoration: "underline", color: "#000" }}>
          Зареєструватися безкоштовно →
        </Link>
      </div>

      <DemoStudentList students={view.students} />
    </div>
  );
}
