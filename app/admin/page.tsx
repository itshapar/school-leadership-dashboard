import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminLogoutButton from "@/components/AdminLogoutButton";
import { ChartLineUp, Ranking, User } from "@phosphor-icons/react/dist/ssr";
import { formatClassCode } from "@/lib/classCodes";
import { loadParallels } from "@/lib/admin/parallels";
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

  // Акцепт Умов: guard для Google OAuth і для наявних акаунтів, які
  // реєструвалися до появи чекбоксів (Етап 5, п. 9).
  const termsAccepted = await hasAcceptedCurrentTerms(supabase);

  const [{ data: classes }, parallels] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, public_code, parallel_id, is_demo")
      // Постійний публічний демо-клас (Етап 9, /demo) технічно належить
      // цьому акаунту, але вчитель не має його бачити у своєму списку —
      // це не його дані, лише носій для публічної демонстрації.
      .eq("is_public_demo", false)
      .is("deleted_at", null)
      .order("name"),
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
    parallel_id: cls.parallel_id,
    is_demo: cls.is_demo ?? false,
    studentCount: studentCounts.get(cls.id) ?? 0,
    lessonCount: lessonCounts.get(cls.id) ?? 0,
    totalStars: starTotals.get(cls.id) ?? 0,
    onboardingDone: progressByClass.get(cls.id)?.doneCount ?? 5,
    onboardingTotal: progressByClass.get(cls.id)?.totalSteps ?? 5,
    onboardingComplete: progressByClass.get(cls.id)?.complete ?? true,
    nextStep: progressByClass.get(cls.id)?.nextStep ?? "class",
  }));

  const isEmpty = cards.length === 0;

  return (
    <div className="page-container" style={{ maxWidth: "860px", paddingBottom: "80px" }}>
      {!termsAccepted && <TermsGate />}

      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-1px" }}>
          Адмін-панель
        </h1>
        <div style={{ marginTop: "16px" }}>
          <Link
            href="/admin/profile"
            className="admin-action-btn admin-btn-white"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "auto" }}
          >
            {/* Виняток із загального bold (живий фідбек): для іконки
                вчителя fill читається краще. 1.45em — той самий розмір, що
                й у CSS-правилі для іконок в antd-кнопках із текстом: це
                посилання-кнопка, під те правило воно не підпадає. */}
            <User weight="fill" style={{ fontSize: "1.45em" }} /> Профіль вчителя
          </Link>
        </div>
      </div>

      {!isEmpty && (
        <>
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
                <div style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Рейтинг учнів</div>
                <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>За паралеллю, класична таблиця рейтингу</div>
              </div>
              <Ranking weight="bold" style={{ fontSize: "2.5rem", color: "var(--color-star)" }} />
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
                <div style={{ opacity: 0.8, fontSize: "0.9rem", fontWeight: 600 }}>За паралеллю, розширена статистика, цілі та графіки</div>
              </div>
              <ChartLineUp weight="bold" style={{ fontSize: "2.5rem", color: "#000" }} />
            </div>
          </Link>
        </>
      )}

      <AdminClassList classes={cards} parallels={parallels} />

      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <AdminLogoutButton />
      </div>
    </div>
  );
}
