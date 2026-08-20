import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { UserOutlined, ReadOutlined, StarFilled, FolderOpenOutlined } from "@ant-design/icons";
import { formatClassCode } from "@/lib/classCodes";
import { buildFolderTree, loadParallels, loadSchools } from "@/lib/admin/folders";
import { getOnboardingProgressBatch } from "@/lib/admin/onboarding";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import AdminClassList, {
  type AdminClassCard,
} from "@/components/Admin/AdminClassList";
import TermsGate from "@/components/Legal/TermsGate";
import { hasAcceptedCurrentTerms } from "@/lib/legal/terms";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPlatformAdmin =
    (user?.app_metadata as Record<string, unknown> | undefined)?.platform_role ===
    "admin";

  // Акцепт Умов: guard для Google OAuth і для наявних акаунтів, які
  // реєструвалися до появи чекбоксів (Етап 5, п. 9).
  const termsAccepted = await hasAcceptedCurrentTerms(supabase);

  const [{ data: classes }, schools, parallels] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, public_code, school_id, parallel_id, is_demo, archived_at")
      .is("deleted_at", null)
      .order("name"),
    loadSchools(supabase),
    loadParallels(supabase),
  ]);

  const classList = classes ?? [];
  const classIds = classList.map((c) => c.id);

  // Один пакет запитів на всі класи замість N×5 — див. lib/admin/onboarding.
  const progressByClass = await getOnboardingProgressBatch(supabase, classIds);

  // Агрегати по класах: учні, уроки, зірки. Публічний RPC тут не годиться —
  // це кабінет власника, дані беруться під його ж RLS.
  //
  // Через fetchAllRows, а не одним select: PostgREST мовчки ріже видачу на
  // 1000 рядків, і star_entries цю межу вже перетнули (1374 на проді). Без
  // пагінації суми зірок у списку класів були б просто заниженими, без
  // жодної помилки.
  const [allStudents, allLessons, allEntries] = classIds.length
    ? await Promise.all([
        fetchAllRows<{ class_id: string }>(() =>
          supabase
            .from("students")
            .select("id, class_id")
            .in("class_id", classIds)
            .is("deleted_at", null)
        ),
        fetchAllRows<{ class_id: string }>(() =>
          supabase
            .from("lessons")
            .select("id, class_id")
            .in("class_id", classIds)
            .is("deleted_at", null)
        ),
        fetchAllRows<{ class_id: string; student_id: string | null; amount: number }>(
          () =>
            supabase
              .from("star_entries")
              .select("class_id, student_id, amount")
              .in("class_id", classIds)
        ),
      ])
    : [[], [], []];

  const countBy = (rows: Array<{ class_id: string }>) => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.class_id, (map.get(r.class_id) ?? 0) + 1));
    return map;
  };

  const studentCounts = countBy(allStudents);
  const lessonCounts = countBy(allLessons);

  const starTotals = new Map<string, number>();
  allEntries.forEach((e) => {
    // Індивідуальні записи рахуємо лише в плюс (як на дашборді),
    // класові — цілком, разом зі штрафами.
    const delta = e.student_id ? (e.amount > 0 ? e.amount : 0) : e.amount;
    starTotals.set(e.class_id, (starTotals.get(e.class_id) ?? 0) + delta);
  });

  const cards: AdminClassCard[] = classList.map((cls) => ({
    id: cls.id,
    name: cls.name,
    public_code: cls.public_code,
    formatted_code: formatClassCode(cls.public_code),
    school_id: cls.school_id,
    parallel_id: cls.parallel_id,
    is_demo: cls.is_demo ?? false,
    archived: Boolean(cls.archived_at),
    studentCount: studentCounts.get(cls.id) ?? 0,
    lessonCount: lessonCounts.get(cls.id) ?? 0,
    totalStars: starTotals.get(cls.id) ?? 0,
    onboardingDone: progressByClass.get(cls.id)?.doneCount ?? 5,
    onboardingTotal: progressByClass.get(cls.id)?.totalSteps ?? 5,
    onboardingComplete: progressByClass.get(cls.id)?.complete ?? true,
  }));

  const tree = buildFolderTree(schools, parallels, cards);
  const hasDemo = cards.some((c) => c.is_demo);

  return (
    <div className="page-container" style={{ maxWidth: "860px", paddingBottom: "80px" }}>
      {!termsAccepted && <TermsGate />}

      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-1px" }}>
          Адмін-панель
        </h1>
        <div style={{ marginTop: "8px", display: "flex", gap: "16px", justifyContent: "center", fontSize: "0.9rem", fontWeight: 700, flexWrap: "wrap" }}>
          <Link href="/admin/profile" style={{ color: "inherit" }}>
            <UserOutlined /> Профіль
          </Link>
          <Link href="/admin/folders" style={{ color: "inherit" }}>
            <FolderOpenOutlined /> Школи та паралелі
          </Link>
          {isPlatformAdmin && (
            <Link href="/admin/platform" style={{ color: "inherit" }}>
              <ReadOutlined /> Платформа
            </Link>
          )}
        </div>
      </div>

      <Link
        href="/admin/total"
        className="total-dashboard-card"
        style={{ display: "block", textDecoration: "none", marginBottom: "16px", transition: "transform 0.2s" }}
      >
        <div className="star-card" style={{
          background: "linear-gradient(135deg, #000000 0%, #2c2c2c 100%)",
          color: "#ffffff",
          border: "none",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Рейтинг усіх учнів</div>
            <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>Всі учні, класична таблиця рейтингу</div>
          </div>
          <StarFilled style={{ fontSize: "2.5rem", color: "var(--color-star)" }} />
        </div>
      </Link>

      <Link
        href="/dashboard"
        className="total-dashboard-card"
        style={{ display: "block", textDecoration: "none", marginBottom: "32px", transition: "transform 0.2s" }}
      >
        <div className="star-card" style={{
          background: "linear-gradient(135deg, #f59f00 0%, #f08c00 100%)",
          color: "#000000",
          border: "3px solid #000",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Загальний дашборд</div>
            <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>Розширена статистика, цілі та графіки</div>
          </div>
          <ReadOutlined style={{ fontSize: "2.5rem", color: "#000" }} />
        </div>
      </Link>

      <AdminClassList
        tree={tree}
        schools={schools}
        parallels={parallels}
        totalClasses={cards.length}
        hasDemo={hasDemo}
      />

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
