import { useRouter } from "expo-router";
import { EmptyState, ScreenBody, ScreenHeader, useIsWide } from "@/components/ui";

export default function AlertsScreen() {
  const router = useRouter();
  const wide = useIsWide();
  return (
    <>
      <ScreenHeader title="Alerts" wide={wide} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScreenBody>
        <EmptyState icon="bell" title="No alerts yet" body="Flags, owner notes and approvals will show here from Phase 7." />
      </ScreenBody>
    </>
  );
}
