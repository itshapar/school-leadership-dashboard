import { Suspense } from "react";
import { Spin } from "antd";
import OnboardingWizard from "@/components/Admin/Onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

/**
 * Майстер онбордингу. Suspense обов'язковий: OnboardingWizard читає
 * useSearchParams (classId, step), і без нього Next.js вимагає
 * client-side bailout на етапі збірки.
 */
export default function OnboardingPage() {
  return (
    <div style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      <Suspense
        fallback={
          <div style={{ padding: 80, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        }
      >
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
