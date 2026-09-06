import type { Metadata } from "next";
import { Suspense } from "react";
import { Spin } from "antd";
import OnboardingWizard from "@/components/Admin/Onboarding/OnboardingWizard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadParallelsEnabled } from "@/lib/admin/parallels";

export const metadata: Metadata = {
  title: "Новий клас",
};

export const dynamic = "force-dynamic";

/**
 * Майстер онбордингу. Suspense обов'язковий: OnboardingWizard читає
 * useSearchParams (classId, step), і без нього Next.js вимагає
 * client-side bailout на етапі збірки.
 */
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const parallelsEnabled = await loadParallelsEnabled(supabase);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <Suspense
        fallback={
          <div style={{ padding: 80, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        }
      >
        <OnboardingWizard parallelsEnabled={parallelsEnabled} />
      </Suspense>
    </div>
  );
}
