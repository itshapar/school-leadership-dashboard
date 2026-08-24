"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Spin,
  Steps,
  Tabs,
  message,
} from "antd";
import { ArrowLeftOutlined, CheckCircleFilled } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  loadClassPrizes,
  loadIndividualPrizes,
  type ClassPrize,
  type IndividualPrize,
} from "@/lib/admin/classConfig";
import { upsertParallelByName } from "@/lib/admin/parallels";
import {
  getOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStepKey,
} from "@/lib/admin/onboarding";
import { formatClassCode } from "@/lib/classCodes";
import PrizesPanel from "@/components/Admin/ClassSettings/PrizesPanel";
import StudentImport from "@/components/Admin/StudentImport";
import StudentLinesInput from "@/components/Admin/Onboarding/StudentLinesInput";
import LessonSeriesForm from "@/components/Admin/LessonSeriesForm";

/**
 * Майстер онбордингу: клас → уроки → учні → призи.
 *
 * До Етапу 9 тут було ще два кроки — «Бали» (ручний вибір/редагування типів
 * нарахувань) і «Коди» (показ коду й генерація PIN-ів). Обидва прибрані:
 * система балів тепер єдиний стандарт для всіх, накочується автоматично
 * одразу при створенні класу (apply_class_template у createClass нижче);
 * код і PIN-и класу переїхали в /admin/[code]/settings — їх варто показувати
 * вже ПІСЛЯ створення класу, а не як обов'язковий крок майстра.
 *
 * lib/admin/onboarding.ts і далі рахує прогрес по ВСІХ п'яти сутностях
 * (клас/учні/бали/призи/коди) — це реальний стан БД і основа бейджа
 * «Налаштувати X/5» у списку класів; майстер лише не показує кроки для
 * «бали» (завжди true одразу) і «коди» (тепер у налаштуваннях).
 *
 * «Уроки» (9.5, живий фідбек) — окремий, повністю необов'язковий крок,
 * не частина прогресу з lib/admin/onboarding.ts (там немає такої сутності):
 * раніше форму серії уроків впихнули ВСЕРЕДИНУ кроку «Клас», а
 * createClass одразу стрибав на «Учні» — форма фізично не встигала
 * показатись. Тепер це власний крок зі своїми «Далі»/«Пропустити».
 *
 * КЛАС СТВОРЮЄТЬСЯ ОДРАЗУ на першому кроці — далі кожен крок працює з
 * реальним class_id, а не з чернеткою.
 */

type WizardStepKey = OnboardingStepKey | "lessons";

const WIZARD_STEPS: Array<{ key: WizardStepKey; title: string }> = [
  { key: "class", title: "Клас" },
  { key: "lessons", title: "Уроки" },
  { key: "students", title: "Учні" },
  { key: "prizes", title: "Нагороди" },
];

// Паралель — номер класу (1–12), фіксований список: учитель обирає
// готовий варіант, а не вигадує назву окремої "теки" (Етап 9, live-фідбек).
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `${n} клас` };
});

interface ClassRow {
  id: string;
  name: string;
  public_code: string;
}

interface StudentLite {
  id: string;
  full_name: string;
  nickname: string | null;
}

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();

  const classIdParam = searchParams.get("classId");
  const stepParam = searchParams.get("step") as WizardStepKey | null;

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(Boolean(classIdParam));

  const [parallelId, setParallelId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | undefined>(undefined);
  const [resolvingGrade, setResolvingGrade] = useState(false);
  const [individualPrizes, setIndividualPrizes] = useState<IndividualPrize[]>([]);
  const [classPrizes, setClassPrizes] = useState<ClassPrize[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [lessonsCount, setLessonsCount] = useState(0);

  const [creating, setCreating] = useState(false);
  const [classForm] = Form.useForm<{ name: string }>();

  const stepIndex = useCallback((key: WizardStepKey) => {
    const i = WIZARD_STEPS.findIndex((s) => s.key === key);
    // "Бали" й "Коди" більше не кроки майстра — найближчий видимий крок: призи.
    return i === -1 ? WIZARD_STEPS.length - 1 : i;
  }, []);

  /** Перезавантажує все, що показує майстер, з БД. */
  const refresh = useCallback(
    async (classId: string) => {
      const [indiv, clsPrizes, prog, studentsRes, lessonsRes] = await Promise.all([
        loadIndividualPrizes(supabase, classId),
        loadClassPrizes(supabase, classId),
        getOnboardingProgress(supabase, classId),
        supabase
          .from("students")
          .select("id, full_name, nickname")
          .eq("class_id", classId)
          .is("deleted_at", null)
          .order("full_name"),
        supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId),
      ]);

      setIndividualPrizes(indiv);
      setClassPrizes(clsPrizes);
      setProgress(prog);
      setStudents((studentsRes.data ?? []) as StudentLite[]);
      setLessonsCount(lessonsRes.count ?? 0);
    },
    [supabase]
  );

  // Початкове завантаження: клас, якщо повернулися в майстер.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!classIdParam) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("classes")
        .select("id, name, public_code")
        .eq("id", classIdParam)
        .maybeSingle();

      if (cancelled) return;

      if (!data) {
        message.error("Клас не знайдено");
        setLoading(false);
        return;
      }

      setCls(data as ClassRow);
      await refresh(data.id);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [classIdParam, supabase, refresh]);

  // Після завантаження прогресу стаємо на потрібний крок: явно вказаний
  // у URL — або перший невиконаний.
  useEffect(() => {
    if (!progress) return;
    setCurrent(stepIndex(stepParam ?? progress.nextStep));
    // stepParam читаємо один раз при завантаженні прогресу: далі крок
    // перемикає сам вчитель, і смикати його з URL було б стрибками.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.classId]);

  async function onGradeChange(grade: string | undefined) {
    setSelectedGrade(grade);
    if (!grade) {
      setParallelId(null);
      return;
    }
    setResolvingGrade(true);
    const { id } = await upsertParallelByName(supabase, grade);
    setResolvingGrade(false);
    setParallelId(id);
  }

  async function createClass(values: { name: string }) {
    setCreating(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setCreating(false);
      message.error("Сесія завершилась. Увійдіть ще раз.");
      return;
    }

    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: values.name.trim(),
        teacher_id: user.user.id,
        parallel_id: parallelId,
      })
      .select("id, name, public_code")
      .single();

    if (error || !data) {
      setCreating(false);
      const limit = error?.message?.includes("Досягнуто ліміт");
      const duplicate = error?.code === "23505";
      message.error(
        limit
          ? "Досягнуто ліміт: не більше 20 класів на акаунт"
          : duplicate
          ? "Клас із такою назвою вже є"
          : "Не вдалося створити клас"
      );
      return;
    }

    // Стандартна система балів — одразу і без питань: вона однакова для всіх.
    await supabase.rpc("apply_class_template", {
      p_class_id: data.id,
      p_template_id: null,
    });

    setCreating(false);
    message.success("Клас створено");
    // Кладемо classId в URL: майстер стає відновлюваним по посиланню.
    router.replace(`/admin/onboarding?classId=${data.id}&step=lessons`);
  }

  const goTo = (index: number) => setCurrent(index);

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  const doneMap = progress?.done;

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link href="/admin">
          <Button
            icon={<ArrowLeftOutlined />}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              height: 38,
              width: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Link>
        <div>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", textTransform: "uppercase", lineHeight: 1.1 }}>
            Новий клас
          </h1>
          <div style={{ color: "#868e96", fontWeight: 700, fontSize: "0.9rem" }}>
            {cls ? cls.name : "Крок за кроком, будь-який можна пропустити"}
          </div>
        </div>
      </div>

      <Steps
        current={current}
        onChange={cls ? goTo : undefined}
        size="small"
        style={{ marginBottom: 28 }}
        items={WIZARD_STEPS.map((s) => ({
          title: s.title,
          disabled: !cls && s.key !== "class",
          // "Уроки" не входить у прогрес lib/admin/onboarding.ts (не одна з
          // п'яти відстежуваних сутностей) — для нього ніколи немає галочки.
          icon:
            s.key !== "lessons" && doneMap?.[s.key] ? (
              <CheckCircleFilled style={{ color: "#2f9e44" }} />
            ) : undefined,
        }))}
      />

      <div
        style={{
          background: "#fff",
          border: "3px solid #000",
          borderRadius: 16,
          boxShadow: "4px 4px 0px #000",
          padding: 24,
        }}
      >
        {/* ───────────────── Крок 1: клас ───────────────── */}
        {current === 0 && (
          <div>
            <StepHeader
              title="Створіть клас"
              hint="Паралель (номер 1–12) необов'язкова. Назва класу, наприклад «7-А» або «ПМ2»."
            />

            {cls ? (
              <Alert
                type="success"
                showIcon
                message={`Клас «${cls.name}» створено`}
                description={
                  <span>
                    Код для учнів: <b>{formatClassCode(cls.public_code)}</b> (повний код і
                    PIN-и учнів у налаштуваннях класу)
                  </span>
                }
              />
            ) : (
              <Form form={classForm} layout="vertical" onFinish={createClass}>
                <Form.Item label={<span style={{ fontWeight: 700 }}>Паралель (необов&apos;язково)</span>}>
                  <Select
                    size="large"
                    allowClear
                    loading={resolvingGrade}
                    placeholder="Клас (1–12)"
                    value={selectedGrade}
                    onChange={onGradeChange}
                    options={GRADE_OPTIONS}
                  />
                </Form.Item>

                <Form.Item
                  name="name"
                  label={<span style={{ fontWeight: 700 }}>Назва класу</span>}
                  rules={[
                    { required: true, message: "Введіть назву" },
                    { max: 60, message: "Занадто довга назва" },
                  ]}
                >
                  <Input size="large" placeholder="7-А, ПМ2…" autoFocus />
                </Form.Item>

                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={creating}
                  style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
                >
                  Створити і продовжити
                </Button>
              </Form>
            )}
          </div>
        )}

        {/* ───────────────── Крок 2: уроки ───────────────── */}
        {current === 1 && cls && (
          <div>
            <StepHeader
              title="Додайте уроки (необов'язково)"
              hint="Кількість уроків можна задати одразу: оберіть дні тижня й період, решту можна додати пізніше в журналі."
            />
            {lessonsCount > 0 && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message={`У класі вже ${lessonsCount} уроків`}
              />
            )}
            <LessonSeriesForm classId={cls.id} onCreated={() => void refresh(cls.id)} />
          </div>
        )}

        {/* ───────────────── Крок 3: учні ───────────────── */}
        {current === 2 && cls && (
          <div>
            <StepHeader
              title="Додайте учнів"
              hint="Рядками або файлом. У будь-якому разі система покаже прев'ю «прізвище | ім'я» на підтвердження."
            />

            {students.length > 0 && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message={`У класі вже ${students.length} учнів`}
              />
            )}

            <Tabs
              items={[
                {
                  key: "lines",
                  label: <span style={{ fontWeight: 700 }}>Рядками</span>,
                  children: (
                    <StudentLinesInput
                      classId={cls.id}
                      onAdded={() => void refresh(cls.id)}
                    />
                  ),
                },
                {
                  key: "file",
                  label: <span style={{ fontWeight: 700 }}>CSV / XLSX</span>,
                  children: (
                    <StudentImport
                      classId={cls.id}
                      onImported={() => void refresh(cls.id)}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* ───────────────── Крок 4: призи ───────────────── */}
        {current === 3 && cls && (
          <div>
            <StepHeader
              title="Нагороди"
              hint="Індивідуальні учень відкриває власними зірками, а класові присуджуються, коли клас разом набирає поріг."
            />

            <Tabs
              items={[
                {
                  key: "individual",
                  label: <span style={{ fontWeight: 700 }}>Індивідуальні</span>,
                  children: (
                    <PrizesPanel
                      classId={cls.id}
                      kind="individual"
                      individualPrizes={individualPrizes}
                      onChanged={() => void refresh(cls.id)}
                    />
                  ),
                },
                {
                  key: "class",
                  label: <span style={{ fontWeight: 700 }}>Класові</span>,
                  children: (
                    <PrizesPanel
                      classId={cls.id}
                      kind="class"
                      classPrizes={classPrizes}
                      onChanged={() => void refresh(cls.id)}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* Навігація. «Далі» ніколи не заблоковане: пропустити можна будь-що. */}
      {cls && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 20,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Button
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
            style={{ fontWeight: 700, borderRadius: 10 }}
          >
            Назад
          </Button>

          <div style={{ display: "flex", gap: 12 }}>
            {current < WIZARD_STEPS.length - 1 ? (
              <>
                <Button
                  type="text"
                  onClick={() => {
                    void refresh(cls.id);
                    goTo(current + 1);
                  }}
                  style={{ fontWeight: 700 }}
                >
                  Пропустити
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    void refresh(cls.id);
                    goTo(current + 1);
                  }}
                  style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
                >
                  Далі
                </Button>
              </>
            ) : (
              <Button
                type="primary"
                onClick={() => router.push(`/admin/${cls.public_code}`)}
                style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
              >
                Готово, до журналу
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: "0 0 6px", fontWeight: 900, fontSize: "1.25rem" }}>{title}</h2>
      <p style={{ margin: 0, color: "#868e96", fontWeight: 600, lineHeight: 1.6 }}>{hint}</p>
    </div>
  );
}
