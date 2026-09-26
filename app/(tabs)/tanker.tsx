import { ScreenBody } from "@/components/ui";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";

export default function TankerScreen() {
  return (
    <>
      <MainHeader title="Tanker" />
      <ScreenBody>
        <ComingSoon icon="truck" line="Tanker receipts arrive in Phase 4." />
      </ScreenBody>
    </>
  );
}
