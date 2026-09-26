import { ScreenBody } from "@/components/ui";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function SalesScreen() {
  return (
    <>
      <MainHeader title="Sales" />
      <ScreenBody>
        <ComingSoon icon="rupee" line="Cash, PhonePe, POS, XtraPower, Bank and Credit per shift arrive in Phase 6." />
      </ScreenBody>
    </>
  );
}
