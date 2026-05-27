import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/analytics";
import BentoGrid from "@/components/dashboard/BentoGrid";
import Link from "next/link";
import "./dashboard.css";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const params = await searchParams;
  const classId = params.classId || null;
  const supabase = await createSupabaseServerClient();

  const data = await getDashboardData(supabase, classId);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Загальний Дашборд</h1>
        <div className="class-filter">
          <Link href="/dashboard" className={`filter-btn ${!classId ? 'active' : ''}`}>
            Всі класи
          </Link>
          {data.classes.map(c => (
            <Link 
              key={c.id} 
              href={`/dashboard?classId=${c.id}`}
              className={`filter-btn ${classId === c.id ? 'active' : ''}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      <BentoGrid data={data} classId={classId} />
    </div>
  );
}
