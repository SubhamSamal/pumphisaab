import { useRouter } from "expo-router";
import { BellButton, ScreenHeader, useIsWide } from "@/components/ui";

/** Header for the main tabs: title (and optional subtitle) with the bell top right. */
export function MainHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const wide = useIsWide();
  return (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      wide={wide}
      right={<BellButton count={0} onPress={() => router.push("/alerts")} />}
    />
  );
}
