import { notFound, redirect } from "next/navigation";
import { getPublicClassOverview } from "@/lib/public/classData";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ classId: string }>;
}

/**
 * Стара сторінка «обери себе зі списку» (Етап 1).
 *
 * Після 024+026 персональний дашборд вимагає PIN-сесію, тож вибір учня зі
 * списку більше не дає доступу — він давав його саме тому, що код класу був
 * спільним секретом. Сторінка лишається як redirect, щоб збережені в
 * браузерах закладки й посилання з торішніх пам'яток вели кудись осмислено,
 * а не в 404.
 */
export default async function StudentPickerPage({ params }: Props) {
  const { classId: classParam } = await params;

  const overview = await getPublicClassOverview(classParam);
  if (!overview) return notFound();

  redirect(`/class/${overview.public_code}/me`);
}
