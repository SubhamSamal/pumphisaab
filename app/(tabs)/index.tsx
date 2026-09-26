import { ScreenBody } from "@/components/ui";
import { currentBusinessDate } from "@/lib/businessDay";
import { fmtDate } from "@/lib/format";
import { useMembership } from "@/features/session/SessionProvider";
import { useBusinessDate } from "@/features/setup/queries";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function TodayScreen() {
  const me = useMembership();
  // The server decides the business date (decision D17); the phone's guess shows only while loading.
  const serverDate = useBusinessDate(me.pump.id);
  const date = serverDate.data ?? currentBusinessDate(me.pump.dayStartTime);

  return (
    <>
      <MainHeader title={me.pump.name} subtitle={fmtDate(date, "weekday")} />
      <ScreenBody>
        <ComingSoon icon="today" line="Daily entry (dips, meters, expenses) arrives in Phase 4." />
      </ScreenBody>
    </>
  );
}
