import { Redirect } from "expo-router";
import { ScreenBody } from "@/components/ui";
import { useSession } from "@/features/session/SessionProvider";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function DashboardScreen() {
  const { role } = useSession();
  if (role !== "owner") return <Redirect href="/" />;
  return (
    <>
      <MainHeader title="Dashboard" />
      <ScreenBody>
        <ComingSoon icon="dashboard" line="Today's summary and the 30-day matched calendar arrive in Phase 6." />
      </ScreenBody>
    </>
  );
}
