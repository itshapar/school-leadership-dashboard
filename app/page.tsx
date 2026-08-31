import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Корінь сайту веде на вхід (живий фідбек перед релізом): лендінг поки
 * прибрано, і людина, яка набрала домен, має одразу бачити форму, а не
 * рекламну сторінку. Сам лендінг лежить у app/_landing і не маршрутизується.
 *
 * Вчителя з живою сесією тримати на формі входу немає сенсу, тому для
 * нього це коротка дорога в кабінет.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/admin" : "/admin/login");
}
