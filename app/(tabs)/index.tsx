import { ScreenBody } from "@/components/ui";
import { currentBusinessDate } from "@/lib/businessDay";
import { fmtDate } from "@/lib/format";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function TodayScreen() {
  return (
    <>
      <MainHeader title="Today" subtitle={fmtDate(currentBusinessDate(), "weekday")} />
      <ScreenBody>
        <ComingSoon icon="today" line="Daily entry (dips, meters, expenses) arrives in Phase 5." />
      </ScreenBody>
    </>
  );
}
