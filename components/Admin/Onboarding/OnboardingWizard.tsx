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
  Tag,
  message,
} from "antd";
import { ArrowLeftOutlined, CheckCircleFilled } from "@ant-design/icons";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  loadClassPrizes,
  loadEntryTypes,
  loadIndividualPrizes,
  type ClassPrize,
  type EntryType,
  type IndividualPrize,
} from "@/lib/admin/classConfig";
import { loadParallels, loadSchools, type Parallel, type School } from "@/lib/admin/folders";
import {
  ONBOARDING_STEPS,
  getOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStepKey,
} from "@/lib/admin/onboarding";
import { formatClassCode } from "@/lib/classCodes";
import EntryTypesPanel from "@/components/Admin/ClassSettings/EntryTypesPanel";
import PrizesPanel from "@/components/Admin/ClassSettings/PrizesPanel";
import StudentImport from "@/components/Admin/StudentImport";
import StudentLinesInput from "@/components/Admin/Onboarding/StudentLinesInput";
import { ResetClassPinsButton } from "@/components/Admin/PinManager";

/**
 * Майстер онбордингу (PRD §5.2): клас → учні → бали → призи → коди.
 *
 * Два рішення, які визначають усю поведінку:
 *
 * 1. КЛАС СТВОРЮЄТЬСЯ ОДРАЗУ на першому кроці. Далі всі кроки працюють із
 *    реальним class_id, тому кожен крок — це звичайна робота з кабінетом,
 *    а не «чернетка», яку треба десь тримати і потім атомарно застосувати.
 *
 * 2. ПРОГРЕС ВИВОДИТЬСЯ З БД, а не зберігається (див. lib/admin/onboarding).
 *    Наслідок: майстер можна закрити на будь-якому кроці, повернутися з
 *    іншого пристрою — і побачити рівно те, що вже зроблено. Пропустити
 *    можна будь-який крок: «Далі» ніколи не заблоковане.
 */

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

const NO_FOLDER = "__none__";

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();

  const classIdParam = searchParams.get("classId");
  const stepParam = searchParams.get("step") as OnboardingStepKey | null;

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(Boolean(classIdParam));

  const [schools, setSchools] = useState<School[]>([]);
  const [parallels, setParallels] = useState<Parallel[]>([]);
  const [entryTypes, setEntryTypes] = useState<EntryType[]>([]);
  const [individualPrizes, setIndividualPrizes] = useState<IndividualPrize[]>([]);
  const [classPrizes, setClassPrizes] = useState<ClassPrize[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);

  const [creating, setCreating] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [classForm] = Form.useForm<{
    name: string;
    school_id: string;
    parallel_id: string;
  }>();

  const stepIndex = useCallback(
    (key: OnboardingStepKey) => ONBOARDING_STEPS.findIndex((s) => s.key === key),
    []
  );

  /** Перезавантажує все, що показує майстер, з БД. */
  const refresh = useCallback(
    async (classId: string) => {
      const [types, indiv, clsPrizes, prog, studentsRes] = await Promise.all([
        loadEntryTypes(supabase, classId),
        loadIndividualPrizes(supabase, classId),
        loadClassPrizes(supabase, classId),
        getOnboardingProgress(supabase, classId),
        supabase
          .from("students")
          .select("id, full_name, nickname")
          .eq("class_id", classId)
          .is("deleted_at", null)
          .order("full_name"),
      ]);

      setEntryTypes(types);
      setIndividualPrizes(indiv);
      setClassPrizes(clsPrizes);
      setProgress(prog);
      setStudents((studentsRes.data ?? []) as StudentLite[]);
    },
    [supabase]
  );

  // Початкове завантаження: папки для кроку 1 + клас, якщо повернулися в майстер.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [s, p] = await Promise.all([loadSchools(supabase), loadParallels(supabase)]);
      if (cancelled) return;
      setSchools(s);
      setParallels(p);

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

  async function createClass(values: {
    name: string;
    school_id?: string;
    parallel_id?: string;
  }) {
    setCreating(true);
    const parallelId =
      values.parallel_id && values.parallel_id !== NO_FOLDER ? values.parallel_id : null;
    const schoolId =
      values.school_id && values.school_id !== NO_FOLDER ? values.school_id : null;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setCreating(false);
      message.error("Сесія завершилась. Увійдіть ще раз.");
      return;
    }

    // Якщо задана паралель — школу проставить тригер class_folder_consistency
    // (міграція 014). Надсилати обидві означало б ризикнути помилкою
    // «Паралель належить іншій школі».
    const { data, error } = await supabase
      .from("classes")
      .insert({
        name: values.name.trim(),
        teacher_id: user.user.id,
        parallel_id: parallelId,
        school_id: parallelId ? null : schoolId,
      })
      .select("id, name, public_code")
      .single();

    setCreating(false);

    if (error || !data) {
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

    message.success("Клас створено");
    // Кладемо classId в URL: майстер стає відновлюваним по посиланню.
    router.replace(`/admin/onboarding?classId=${data.id}&step=students`);
  }

  async function applyTemplate() {
    if (!cls) return;
    setApplyingTemplate(true);
    const { error } = await supabase.rpc("apply_class_template", {
      p_class_id: cls.id,
      p_template_id: null,
    });
    setApplyingTemplate(false);

    if (error) {
      message.error("Не вдалося застосувати шаблон");
      return;
    }
    message.success("Стандартну систему балів застосовано");
    await refresh(cls.id);
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
            {cls ? cls.name : "Крок за кроком — будь-який можна пропустити"}
          </div>
        </div>
      </div>

      <Steps
        current={current}
        onChange={cls ? goTo : undefined}
        size="small"
        style={{ marginBottom: 28 }}
        items={ONBOARDING_STEPS.map((s) => ({
          title: s.title,
          disabled: !cls && s.key !== "class",
          icon: doneMap?.[s.key] ? (
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
              hint="Назва — єдине обов'язкове поле. Школу та паралель можна не вказувати: це лише папки для зручності."
            />

            {cls ? (
              <Alert
                type="success"
                showIcon
                message={`Клас «${cls.name}» створено`}
                description={
                  <span>
                    Код для учнів: <b>{formatClassCode(cls.public_code)}</b>
                  </span>
                }
              />
            ) : (
              <Form
                form={classForm}
                layout="vertical"
                onFinish={createClass}
                initialValues={{ school_id: NO_FOLDER, parallel_id: NO_FOLDER }}
              >
                <Form.Item
                  name="name"
                  label={<span style={{ fontWeight: 700 }}>Назва класу</span>}
                  rules={[
                    { required: true, message: "Введіть назву" },
                    { max: 60, message: "Занадто довга назва" },
                  ]}
                >
                  <Input size="large" placeholder="7-А" autoFocus />
                </Form.Item>

                <Form.Item
                  name="school_id"
                  label={<span style={{ fontWeight: 700 }}>Школа (необов&apos;язково)</span>}
                >
                  <Select
                    size="large"
                    options={[
                      { value: NO_FOLDER, label: "— без школи" },
                      ...schools.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="parallel_id"
                  label={<span style={{ fontWeight: 700 }}>Паралель (необов&apos;язково)</span>}
                  extra={
                    <span style={{ color: "#868e96", fontSize: "0.8rem" }}>
                      Якщо обрати паралель, школа візьметься з неї.{" "}
                      <Link href="/admin/folders" style={{ fontWeight: 700 }}>
                        Керувати папками
                      </Link>
                    </span>
                  }
                >
                  <Select
                    size="large"
                    options={[
                      { value: NO_FOLDER, label: "— без паралелі" },
                      ...parallels.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
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

        {/* ───────────────── Крок 2: учні ───────────────── */}
        {current === 1 && cls && (
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

        {/* ───────────────── Крок 3: бали ───────────────── */}
        {current === 2 && cls && (
          <div>
            <StepHeader
              title="Система балів"
              hint="Типи нарахувань визначають, за що учні отримують зірки. Можна взяти стандартний набір і змінити пізніше."
            />

            {entryTypes.length === 0 ? (
              <div style={{ marginBottom: 20 }}>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Почніть зі стандартного шаблону"
                  description="Урок ⭐, Бонус 🎁, Штраф ⚡ плюс типовий набір призів. Усе редагується."
                />
                <Button
                  type="primary"
                  loading={applyingTemplate}
                  onClick={applyTemplate}
                  style={{ background: "#000", fontWeight: 800, borderRadius: 10 }}
                >
                  Застосувати стандартний шаблон
                </Button>
              </div>
            ) : null}

            <EntryTypesPanel
              classId={cls.id}
              types={entryTypes}
              onChanged={() => void refresh(cls.id)}
            />
          </div>
        )}

        {/* ───────────────── Крок 4: призи ───────────────── */}
        {current === 3 && cls && (
          <div>
            <StepHeader
              title="Призи та пороги"
              hint="Індивідуальні призи учень відкриває власними зірками; класові — коли клас разом набирає поріг."
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

        {/* ───────────────── Крок 5: коди ───────────────── */}
        {current === 4 && cls && (
          <div>
            <StepHeader
              title="Код класу та PIN-и"
              hint="Учні заходять на сторінку /student за кодом класу і власним PIN-ом. PIN-и показуються ОДИН раз — одразу скопіюйте або роздрукуйте пам'ятку."
            />

            <div
              style={{
                background: "#f8f9fa",
                border: "2px solid #dee2e6",
                borderRadius: 12,
                padding: "18px 20px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#868e96", textTransform: "uppercase" }}>
                Код класу
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "1.8rem",
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  marginTop: 4,
                }}
              >
                {formatClassCode(cls.public_code)}
              </div>
            </div>

            {students.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="Спершу додайте учнів"
                description="PIN-и генеруються для наявних учнів класу."
              />
            ) : (
              <>
                {progress?.done.codes && (
                  <Tag color="green" style={{ fontWeight: 700, marginBottom: 12 }}>
                    PIN-и вже роздано
                  </Tag>
                )}
                <ResetClassPinsButton
                  classId={cls.id}
                  publicCode={cls.public_code}
                  className={cls.name}
                  students={students}
                />
              </>
            )}
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
            {current < ONBOARDING_STEPS.length - 1 ? (
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
                Готово — до журналу
              </Button>
            )}
          </div>
        </div>
      )}

      {cls && progress && !progress.complete && (
        <div style={{ marginTop: 16, textAlign: "center", color: "#868e96", fontSize: "0.82rem", fontWeight: 600 }}>
          Виконано {progress.doneCount} з {progress.totalSteps}. Можна вийти й
          повернутися пізніше — прогрес не загубиться.
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
