import { Redirect } from "expo-router";
import { ScreenBody } from "@/components/ui";
import { useRole } from "@/features/session/RoleProvider";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function DashboardScreen() {
  const { role } = useRole();
  if (role !== "owner") return <Redirect href="/" />;
  return (
    <>
      <MainHeader title="Dashboard" />
      <ScreenBody>
        <ComingSoon icon="dashboard" line="Today's summary and the 30-day matched calendar arrive in Phase 8." />
      </ScreenBody>
    </>
  );
}
