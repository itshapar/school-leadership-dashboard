import { redirect } from "next/navigation";
import { PUBLIC_DEMO_CLASS_CODE } from "@/lib/publicDemo";

/**
 * Публічне демо без реєстрації (Етап 9): просто веде на вже публічну
 * сторінку класу (/class/[code]), яка сама показує банер "Зареєструватися",
 * коли клас позначений is_public_demo. Окремого UI тут не потрібно.
 */
export default function DemoPage() {
  redirect(`/class/${PUBLIC_DEMO_CLASS_CODE}`);
}
